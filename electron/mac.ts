// macOS specifics: the menu bar (a Mac app needs one for ⌘Q, copy/paste in text fields and so on) and the
// title-bar double-click, which follows the system setting (zoom, minimize or nothing).
import { app, Menu, shell, systemPreferences, type BrowserWindow, type MenuItemConstructorOptions } from 'electron';

export const isMac = process.platform === 'darwin';

const HOMEPAGE = 'https://github.com/mojtabatn/Ocean-video-player';

/**
 * Menu bar. Items run the same actions as Ocean's own menu and shortcuts: the renderer gets a key press first,
 * so ⌘O, ⌘M and the rest keep doing what Ocean's shortcuts say; the menu handles them while typing in a text
 * field and when clicked.
 */
export function installMacMenu(current: () => BrowserWindow | null) {
  const run = (id: string) => () => current()?.webContents.send('app:menu-action', id);
  const item = (label: string, id: string, accelerator?: string): MenuItemConstructorOptions => ({ label, accelerator, click: run(id) });

  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        item('Check for Updates…', 'checkUpdates'),
        { type: 'separator' },
        item('Settings…', 'settings', 'Cmd+,'),
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        item('Open File…', 'open', 'Cmd+O'),
        item('Open URL…', 'openUrl', 'Cmd+U'),
        item('Load Subtitle…', 'loadSubtitle', 'Cmd+Shift+O'),
        { type: 'separator' },
        item('Screenshot', 'screenshot', 'Cmd+E'),
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        item('Playlist', 'playlist', 'Cmd+L'),
        item('Media Info', 'mediaInfo', 'Cmd+I'),
        { type: 'separator' },
        // Not the plain F key: a menu would take it from text fields too. ⌃⌘F, the usual Mac one.
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { label: 'Minimize', click: () => current()?.minimize() },
        { role: 'zoom' },
        { type: 'separator' },
        item('Mini Player', 'miniPlayer', 'Cmd+M'),
        item('Always on Top', 'alwaysOnTop', 'Cmd+T'),
        item('Picture in Picture', 'pip', 'Cmd+P'),
        { type: 'separator' },
        { role: 'front' },
      ],
    },
    {
      role: 'help',
      submenu: [
        item('Ocean Help', 'help'),
        item('Keyboard Shortcuts', 'shortcuts', 'Cmd+/'),
        { type: 'separator' },
        { label: 'Ocean on GitHub', click: () => void shell.openExternal(HOMEPAGE) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function toggleMaximize(w: BrowserWindow) {
  if (w.isMaximized()) w.unmaximize();
  else w.maximize();
}

/** Double-click on Ocean's title bar: maximize/restore; on a Mac, whatever System Settings › Desktop & Dock says. */
export function titleBarDoubleClick(w: BrowserWindow) {
  if (!isMac) return toggleMaximize(w);
  // macOS may already have acted on the double-click itself; only step in if the window did not change.
  const before = w.getBounds();
  setTimeout(() => {
    if (w.isDestroyed() || w.isMinimized() || w.isFullScreen()) return;
    const now = w.getBounds();
    if (now.x !== before.x || now.y !== before.y || now.width !== before.width || now.height !== before.height) return;
    const action = systemPreferences.getUserDefault('AppleActionOnDoubleClick', 'string');
    if (action === 'Minimize') w.minimize();
    else if (action !== 'None') toggleMaximize(w);
  }, 250);
}
