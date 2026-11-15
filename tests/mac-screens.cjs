// Screenshots of the packaged macOS app for review, taken with macOS's own screencapture (so the menu bar and the
// window's traffic-light buttons are in the picture). Run by the CI on a Mac when asked for.
// Usage: node tests/mac-screens.cjs "<path to Ocean Player.app>" <video> <out-dir>
const { chromium } = require('playwright-core');
const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const [appPath, video, outDir] = process.argv.slice(2);
const PORT = 9334;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(outDir, { recursive: true });
const exe = path.join(appPath, 'Contents/MacOS', path.basename(appPath, '.app'));
const sh = (cmd, args) => {
  try {
    execFileSync(cmd, args, { stdio: 'inherit', timeout: 15000 });
    return true;
  } catch (e) {
    console.log(`${cmd} failed: ${e.message.split('\n')[0]}`);
    return false;
  }
};

async function start(args) {
  const child = spawn(exe, [`--remote-debugging-port=${PORT}`, ...args], {
    env: { ...process.env, OCEAN_USER_DATA: path.resolve(outDir, '..', 'screens-profile') },
    stdio: 'ignore',
  });
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break;
    } catch {
      /* not yet */
    }
    await sleep(500);
  }
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
  let page;
  for (let i = 0; i < 60 && !page; i++) {
    page = browser.contexts().flatMap((c) => c.pages()).find((p) => /index\.html/.test(p.url()));
    if (!page) await sleep(500);
  }
  await page.waitForSelector('.titlebar', { timeout: 30000 });
  sh('open', ['-a', appPath]); // bring it to the front, so the menu bar is Ocean's
  await sleep(2500);
  return { child, browser, page };
}

/** The window, with a margin of desktop around it, and the whole screen (menu bar included). */
async function shoot(page, name, { full = false } = {}) {
  const b = await page.evaluate(() => ({ x: window.screenX, y: window.screenY, w: window.outerWidth, h: window.outerHeight }));
  const m = 24;
  const file = path.join(outDir, `${name}.png`);
  if (full) sh('screencapture', ['-x', file]);
  else sh('screencapture', ['-x', `-R${Math.max(0, b.x - m)},${Math.max(0, b.y - m)},${b.w + 2 * m},${b.h + 2 * m}`, file]);
  console.log('saved', file, JSON.stringify(b));
}

async function stop({ child, browser }) {
  await browser.close().catch(() => {});
  child.kill('SIGKILL');
  await sleep(1500);
}

(async () => {
  sh('system_profiler', ['SPDisplaysDataType']);

  // 1. Home screen, as the whole screen and as the window.
  let app = await start([]);
  await shoot(app.page, '01-desktop', { full: true });
  await shoot(app.page, '02-home');

  // 2. Ocean's own menu (shortcuts shown with ⌘).
  await app.page.click('.titlebar button[aria-label="Menu"]');
  await sleep(800);
  await shoot(app.page, '03-menu');
  await app.page.keyboard.press('Escape');
  await sleep(400);

  // 3. Keyboard shortcuts and Settings.
  await app.page.keyboard.press('Meta+Slash');
  await sleep(900);
  await shoot(app.page, '04-shortcuts');
  await app.page.keyboard.press('Escape');
  await sleep(400);
  await app.page.keyboard.press('Meta+Comma');
  await sleep(900);
  await shoot(app.page, '05-settings');
  await app.page.keyboard.press('Escape');
  await sleep(400);

  // 4. The Mac menu bar's File menu (needs Accessibility access for the runner; skipped if not granted).
  if (sh('osascript', ['-e', 'tell application "System Events" to tell process "Ocean Player" to click menu bar item "File" of menu bar 1'])) {
    await sleep(800);
    await shoot(app.page, '06-file-menu', { full: true });
    sh('osascript', ['-e', 'tell application "System Events" to key code 53']);
  }
  await stop(app);

  // 5. Playing a video, with the controls showing.
  app = await start([video]);
  for (let i = 0; i < 60; i++) {
    const t = await app.page.evaluate(() => window.__oceanPlayer?.getSnapshot().time ?? 0);
    if (t > 4) break;
    await sleep(500);
  }
  const vp = await app.page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  await app.page.mouse.move(vp.w / 2, vp.h / 2);
  await app.page.mouse.move(vp.w / 2 + 40, vp.h - 120, { steps: 5 });
  await sleep(500);
  await shoot(app.page, '07-player');
  await stop(app);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
