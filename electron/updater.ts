// Updates from GitHub Releases: check for a newer version, read release notes, download the installer and run it.
// No third-party updater: the CI workflows publish Ocean-Player-Setup.exe (Windows) and Ocean-Player-mac-<arch>.dmg
// (macOS) on each release.
import { app, net, shell } from 'electron';
import { execFile, spawn } from 'node:child_process';
import { constants, existsSync } from 'node:fs';
import { createWriteStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { GITHUB_REPO, type UpdateInfo, type UpdateProgress } from '../shared/app';

const repo = () => process.env.OCEAN_GITHUB_REPO ?? GITHUB_REPO;
const api = () => process.env.OCEAN_UPDATE_API ?? 'https://api.github.com';
const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'Ocean-Player-Updater', 'X-GitHub-Api-Version': '2022-11-28' };

type Release = {
  tag_name: string;
  html_url: string;
  body?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets: { name: string; size: number; browser_download_url: string }[];
};

/** 0.10.1 vs 0.9.0 → compares numbers part by part. */
export function isNewer(a: string, b: string) {
  const parse = (v: string) => v.replace(/^v/i, '').split(/[.+-]/).map((x) => parseInt(x, 10) || 0);
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  }
  return false;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await net.fetch(url, { headers });
  if (res.status === 404) throw new Error('No releases found on GitHub yet');
  if (res.status === 403 || res.status === 429) throw new Error('GitHub is rate-limiting requests right now; try again later');
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  return (await res.json()) as T;
}

/** This system's download: the Mac disk image for this processor, or the Windows installer (else the zip). */
function pickAsset(r: Release) {
  if (process.platform === 'darwin') {
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    return r.assets.find((a) => /\.dmg$/i.test(a.name) && new RegExp(`mac.*${arch}`, 'i').test(a.name));
  }
  return (
    r.assets.find((a) => /setup.*\.exe$/i.test(a.name)) ??
    r.assets.find((a) => /\.exe$/i.test(a.name)) ??
    r.assets.find((a) => /win.*\.zip$/i.test(a.name)) ??
    r.assets.find((a) => /\.zip$/i.test(a.name))
  );
}

let latestRelease: Release | null = null;

export async function checkForUpdate(): Promise<UpdateInfo> {
  const current = app.getVersion();
  if (!repo()) return { configured: false, current, available: false };
  try {
    const r = await getJson<Release>(`${api()}/repos/${repo()}/releases/latest`);
    latestRelease = r;
    const latest = r.tag_name.replace(/^v/i, '');
    const asset = pickAsset(r);
    return { configured: true, current, latest, available: isNewer(latest, current) && !!asset, pageUrl: r.html_url, assetName: asset?.name, assetSize: asset?.size };
  } catch (e) {
    return { configured: true, current, available: false, error: (e as Error).message };
  }
}

/** Release notes of the version that is running now (shown as "What's new"). */
export async function releaseNotes(): Promise<{ version: string; notes: string }> {
  const version = app.getVersion();
  if (!repo()) return { version, notes: '' };
  try {
    const r = await getJson<Release>(`${api()}/repos/${repo()}/releases/tags/v${version}`);
    return { version, notes: (r.body ?? '').trim() };
  } catch {
    return { version, notes: '' };
  }
}

let downloading = false;

/** Downloads the new release's installer with progress, then runs it (installer) or shows it (zip). */
export async function downloadAndInstall(onProgress: (p: UpdateProgress) => void): Promise<void> {
  if (downloading) return;
  if (!latestRelease) await checkForUpdate();
  const asset = latestRelease && pickAsset(latestRelease);
  if (!asset) return onProgress({ received: 0, total: 0, error: 'No download found for this release.' });
  const url = asset.browser_download_url;
  if (!/^https:\/\//i.test(url) && !process.env.OCEAN_UPDATE_API) return onProgress({ received: 0, total: 0, error: 'Refusing a non-HTTPS download.' });

  downloading = true;
  const dir = path.join(app.getPath('temp'), 'ocean-update');
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, asset.name);
  try {
    const res = await net.fetch(url, { headers: { 'User-Agent': headers['User-Agent'] }, redirect: 'follow' });
    if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);
    const total = Number(res.headers.get('content-length')) || asset.size;
    const out = createWriteStream(file);
    let received = 0;
    let last = 0;
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (!out.write(value)) await new Promise<void>((r) => out.once('drain', () => r()));
      if (Date.now() - last > 150) {
        last = Date.now();
        onProgress({ received, total });
      }
    }
    await new Promise<void>((resolve, reject) => out.end((e: Error | null | undefined) => (e ? reject(e) : resolve())));
    if (total && received < total) throw new Error('The download was cut short. Try again.');
    onProgress({ received, total: total || received, done: true, file });
    if (process.env.OCEAN_UPDATE_DRYRUN) return;
    if (/\.exe$/i.test(file)) {
      // Installed copy (it has the installer's uninstaller beside it): update silently in the same folder and
      // start the new version when done. A portable copy gets the normal installer wizard instead.
      const installed = existsSync(path.join(path.dirname(process.execPath), 'Uninstall Ocean Player.exe'));
      if (installed) {
        spawn(file, ['/S', '--updated', '--force-run'], { detached: true, stdio: 'ignore' }).unref();
      } else {
        await shell.openPath(file);
      }
      // Let the installer take over: it replaces the files in place and starts the new version itself.
      setTimeout(() => {
        app.quit(); // runs the normal shutdown (stops ffmpeg so the installer can replace its files)
        setTimeout(() => app.exit(0), 3000);
      }, installed ? 600 : 800);
    } else if (/\.dmg$/i.test(file)) {
      // Replace this copy of the app with the one in the disk image and start it again; where that is not possible
      // (a read-only place, run straight from the disk image) Finder opens the image to drag the app over by hand.
      const replaced = await stageMacUpdate(file).catch((e: Error) => {
        console.warn('In-place update failed:', e.message);
        return false;
      });
      if (!replaced) await shell.openPath(file);
      setTimeout(() => {
        app.quit();
        setTimeout(() => app.exit(0), 3000);
      }, replaced ? 400 : 1500);
    } else {
      shell.showItemInFolder(file);
    }
  } catch (e) {
    await fs.rm(file, { force: true }).catch(() => {});
    onProgress({ received: 0, total: 0, error: (e as Error).message });
  } finally {
    downloading = false;
  }
}

const exec = promisify(execFile);

/**
 * macOS: copies the app out of the downloaded disk image next to the running one, then hands over to a small shell
 * script that waits for Ocean to quit, swaps the two and starts the new version. Returns false when this copy
 * cannot be replaced in place.
 */
async function stageMacUpdate(dmg: string): Promise<boolean> {
  const bundle = path.resolve(process.execPath, '../../..'); // …/Ocean Player.app/Contents/MacOS/Ocean Player
  // Opened from the disk image, or from Downloads before being moved (macOS then runs it from a hidden read-only
  // copy): there is nothing to replace.
  if (!bundle.endsWith('.app') || bundle.includes('/AppTranslocation/') || bundle.startsWith('/Volumes/')) return false;
  const parent = path.dirname(bundle);
  try {
    await fs.access(parent, constants.W_OK);
    await fs.access(bundle, constants.W_OK);
  } catch {
    return false;
  }

  const mount = path.join(path.dirname(dmg), 'mount');
  await fs.rm(mount, { recursive: true, force: true });
  await fs.mkdir(mount, { recursive: true });
  const staged = path.join(parent, `.${path.basename(bundle, '.app')}-update.app`);
  await exec('hdiutil', ['attach', '-nobrowse', '-noautoopen', '-readonly', '-mountpoint', mount, dmg]);
  try {
    const name = (await fs.readdir(mount)).find((n) => n.endsWith('.app'));
    if (!name) throw new Error('No app in the disk image');
    await fs.rm(staged, { recursive: true, force: true });
    await exec('ditto', [path.join(mount, name), staged]); // keeps the bundle exactly as built (signature included)
  } finally {
    await exec('hdiutil', ['detach', mount, '-force']).catch(() => {});
  }
  spawn('/bin/sh', ['-c', SWAP_SCRIPT, 'ocean-update', String(process.pid), bundle, staged], { detached: true, stdio: 'ignore' }).unref();
  return true;
}

// $1 Ocean's pid, $2 the installed app, $3 the new copy. Keeps the old app if the swap fails.
const SWAP_SCRIPT = `
pid="$1"; app="$2"; new="$3"; old="$app.old-$$"
i=0; while kill -0 "$pid" 2>/dev/null && [ $i -lt 300 ]; do sleep 0.2; i=$((i+1)); done
if mv "$app" "$old"; then
  if mv "$new" "$app"; then rm -rf "$old"; else mv "$old" "$app"; fi
fi
rm -rf "$new"
xattr -dr com.apple.quarantine "$app" 2>/dev/null
open "$app"
`;
