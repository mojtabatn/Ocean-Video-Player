import { loadRaw, save } from './storage';

export type ChangeKind = 'new' | 'improved' | 'fixed';
export type Release = { version: string; date: string; items: { kind: ChangeKind; text: string }[] };

/**
 * What changed in each version, newest first. Bundled with the app so the "What's new" window works offline
 * and right after an update. Keep the top entry in step with package.json's version.
 */
export const CHANGELOG: Release[] = [
  {
    version: '0.1.7',
    date: '2026-11-15',
    items: [
      { kind: 'new', text: 'Ocean for Mac — for Apple Silicon and Intel Macs, with hardware video conversion and the Mac menu bar.' },
      { kind: 'new', text: 'A Settings button in the top bar, next to the menu, and a new home icon.' },
      { kind: 'improved', text: 'Settings are arranged in tabs — Account, Playback, Audio, Subtitles, Online playback and About.' },
      { kind: 'fixed', text: 'Converting a video on the fly no longer gives up when FFmpeg is slow to start the first time.' },
      { kind: 'fixed', text: 'Help shows the version you actually have.' },
    ],
  },
  {
    version: '0.1.6',
    date: '2026-11-15',
    items: [
      { kind: 'new', text: 'Choose where the sound plays: Audio › Output device lists your speakers, headphones and HDMI outputs.' },
      { kind: 'new', text: 'IMDb score and a Bookmark button right in the quality picker.' },
      { kind: 'new', text: 'This window — see what changed after every update.' },
      { kind: 'improved', text: 'File sizes show a spinner while they load, and a note appears when the site’s download server isn’t answering.' },
      { kind: 'improved', text: 'Searching the site keeps the screen tidy: only the results are shown until you clear the search.' },
      { kind: 'improved', text: 'Gentler with busy download servers — fewer connections at once and automatic retries.' },
      { kind: 'fixed', text: 'The bookmark button on Trending posters works again after scrolling the row.' },
    ],
  },
  {
    version: '0.1.5',
    date: '2026-11-14',
    items: [
      { kind: 'fixed', text: 'Online playback works while the download server’s security certificate has expired (can be turned off in Settings).' },
      { kind: 'improved', text: 'When a file can’t be opened, the real reason is shown, with a “Show details” link.' },
      { kind: 'improved', text: 'Narrower volume slider, leaving more room for the timeline.' },
    ],
  },
  {
    version: '0.1.4',
    date: '2026-11-14',
    items: [{ kind: 'improved', text: 'Smaller, tidier titles for the home screen tabs.' }],
  },
  {
    version: '0.1.3',
    date: '2026-11-14',
    items: [
      { kind: 'new', text: 'Bookmarks — keep any movie or series on the home screen without searching again.' },
      { kind: 'new', text: 'Recently Watched with progress bars; one click continues where you stopped.' },
      { kind: 'new', text: 'New notification cards and loading / not-found / unreadable-format screens.' },
      { kind: 'improved', text: 'Updates install quietly in place and Ocean restarts by itself.' },
      { kind: 'fixed', text: 'Online subtitles stay in sync after jumping around the timeline.' },
    ],
  },
];

/** Compares dotted version numbers: >0 when a is newer than b. */
export function compareVersions(a: string, b: string) {
  const pa = a.replace(/^v/, '').split('.').map(Number), pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

/** Releases newer than `since` up to `current` (just `current` when `since` is unknown). */
export function releasesSince(current: string, since: string | null) {
  return CHANGELOG.filter((r) => compareVersions(r.version, current) <= 0 && (since ? compareVersions(r.version, since) > 0 : r.version === current));
}

const SEEN = 'ocean.seenVersion';

/**
 * Decides once per start whether to show "What's new": after an update (the stored version is older), not on a
 * fresh install. Users updating from versions before this window existed have settings but no stored version.
 */
export function whatsNewOnStart(current: string): { show: boolean; since: string | null } {
  const seen = loadRaw<string | null>(SEEN, null);
  save(SEEN, current);
  if (seen) return { show: compareVersions(current, seen) > 0 && releasesSince(current, seen).length > 0, since: seen };
  const hadSettings = (() => {
    try {
      return !!localStorage.getItem('ocean.settings');
    } catch {
      return false;
    }
  })();
  return { show: hadSettings && releasesSince(current, null).length > 0, since: null };
}
