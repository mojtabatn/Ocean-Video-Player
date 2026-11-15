// Smoke test of the packaged macOS app, run by the CI on a Mac: starts it, checks the window and the Mac title bar,
// then plays one file that must be converted on the fly (MPEG-4 Part 2 + AC3 in AVI → FFmpeg + VideoToolbox).
// Usage: node tests/mac-smoke.cjs "<path to Ocean Player.app>" <ffmpeg> <out-dir>
// Needs playwright-core (npm i --no-save playwright-core). The app is started here with a DevTools port and
// Playwright attaches to it over CDP.
const { chromium } = require('playwright-core');
const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const [appPath, ffmpeg, outDir] = process.argv.slice(2);
const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(outDir, { recursive: true });

const video = path.resolve(outDir, 'smoke.avi');
execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y',
  '-f', 'lavfi', '-i', 'testsrc2=d=20:s=1280x720:r=25', '-f', 'lavfi', '-i', 'sine=f=440:d=20',
  '-c:v', 'mpeg4', '-q:v', '4', '-c:a', 'ac3', video]);

async function devtoolsUp(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return true;
    } catch {
      /* not yet */
    }
    await sleep(500);
  }
  return false;
}

(async () => {
  const exe = path.join(appPath, 'Contents/MacOS', path.basename(appPath, '.app'));
  const log = fs.openSync(path.join(outDir, 'app.log'), 'w');
  const child = spawn(exe, [`--remote-debugging-port=${PORT}`, video], {
    env: { ...process.env, OCEAN_USER_DATA: path.resolve(outDir, 'profile'), ELECTRON_ENABLE_LOGGING: '1' },
    stdio: ['ignore', log, log],
  });
  let exited = null;
  child.on('exit', (code, signal) => (exited = `${code ?? signal}`));
  const stop = () => {
    try {
      child.kill('SIGKILL');
    } catch {
      /* gone */
    }
  };

  try {
    // Generous: an Intel build on an Apple Silicon runner first waits for Rosetta to translate all of Electron.
    if (!(await devtoolsUp(180000))) {
      throw new Error(`DevTools port never answered${exited ? ` (app exited: ${exited})` : ''}`);
    }
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
    let page;
    for (let i = 0; i < 60 && !page; i++) {
      page = browser.contexts().flatMap((c) => c.pages()).find((p) => /index\.html/.test(p.url()));
      if (!page) await sleep(500);
    }
    if (!page) throw new Error('No app window');
    page.on('pageerror', (e) => console.log('pageerror:', e.message));
    await page.waitForSelector('.titlebar', { timeout: 30000 });

    const bar = await page.evaluate(() => ({
      mac: !!document.querySelector('.titlebar--mac'),
      windowButtons: document.querySelectorAll('.titlebar .wc').length,
      platform: window.ocean?.platform,
    }));
    console.log('title bar:', JSON.stringify(bar));

    let state = {};
    const end = Date.now() + 45000;
    while (Date.now() < end) {
      state = await page.evaluate(() => {
        const s = window.__oceanPlayer?.getSnapshot();
        return s ? { mode: s.mode, encoder: s.plan?.videoEncoder, reason: s.plan?.reason, time: s.time, error: s.error, w: s.videoWidth } : {};
      });
      if (state.error || state.time > 3) break;
      await sleep(500);
    }
    console.log('playback:', JSON.stringify(state));
    await page.screenshot({ path: path.join(outDir, 'playing.png') });
    await browser.close().catch(() => {});

    if (!(bar.mac && bar.windowButtons === 1 && bar.platform === 'darwin')) throw new Error('The Mac title bar is not in use');
    if (!(state.time > 3) || state.error) throw new Error(`Playback did not start: ${state.error ?? 'timed out'}`);
    console.log('Smoke test passed');
  } finally {
    stop();
  }
})().catch((e) => {
  console.error(e.message);
  console.error('--- app log ---\n' + fs.readFileSync(path.join(outDir, 'app.log'), 'utf8').split('\n').slice(-80).join('\n'));
  process.exit(1);
});
