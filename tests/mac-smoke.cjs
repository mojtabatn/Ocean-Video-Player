// Smoke test of the packaged macOS app, run by the CI on a Mac: starts it, checks the window and the Mac title bar,
// then plays one file that must be converted on the fly (MPEG-4 Part 2 in AVI → FFmpeg + VideoToolbox).
// Usage: node tests/mac-smoke.cjs "<path to Ocean Player.app>" <ffmpeg> <out-dir>
// Needs playwright-core (npm i --no-save playwright-core).
const { _electron } = require('playwright-core');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const [appPath, ffmpeg, outDir] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(outDir, { recursive: true });

const video = path.join(outDir, 'smoke.avi');
execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y',
  '-f', 'lavfi', '-i', 'testsrc2=d=20:s=1280x720:r=25', '-f', 'lavfi', '-i', 'sine=f=440:d=20',
  '-c:v', 'mpeg4', '-q:v', '4', '-c:a', 'mp3', video]);

(async () => {
  const exe = path.join(appPath, 'Contents/MacOS', path.basename(appPath, '.app'));
  const app = await _electron.launch({
    executablePath: exe,
    args: [video],
    env: { ...process.env, OCEAN_USER_DATA: path.join(outDir, 'profile') },
    timeout: 60000,
  });
  const page = await app.firstWindow();
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
      return s ? { mode: s.mode, encoder: s.plan?.videoEncoder, time: s.time, error: s.error, w: s.videoWidth } : {};
    });
    if (state.error || state.time > 3) break;
    await sleep(500);
  }
  console.log('playback:', JSON.stringify(state));
  await page.screenshot({ path: path.join(outDir, 'playing.png') });
  await app.close();

  const ok = bar.mac && bar.windowButtons === 1 && bar.platform === 'darwin';
  if (!ok) throw new Error('The Mac title bar is not in use');
  if (!(state.time > 3) || state.error) throw new Error(`Playback did not start: ${state.error ?? 'timed out'}`);
  console.log('Smoke test passed');
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
