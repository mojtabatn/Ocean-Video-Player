import { useEffect, useState, type ReactNode } from 'react';
import logo from '../../assets/logo.svg';
import { ABOUT } from '../../lib/about';
import type { UpdateState } from '../../lib/updates';
import { useAccount } from '../../lib/account';
import { ocean } from '../../lib/bridge';
import type { Settings } from '../../lib/settings';
import { Button, Dialog, Range, Row, Select, Toggle } from '../ui';

const LANGS = [
  { value: '', label: 'File default' },
  { value: 'fa', label: 'Persian' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'Arabic' },
  { value: 'tr', label: 'Turkish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
];

const gb = (b: number) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} GB` : `${Math.round(b / 1024 ** 2)} MB`);

export type SettingsTab = 'account' | 'playback' | 'audio' | 'subtitles' | 'online' | 'about';

const icon = (d: ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);

const TABS: { id: SettingsTab; label: string; about: string; icon: ReactNode }[] = [
  {
    id: 'account',
    label: 'Account',
    about: 'Film2Media sign-in for trending titles and online playback.',
    icon: icon(<><circle cx="10" cy="7.2" r="3.2" /><path d="M3.8 16.8c.9-3 3.3-4.6 6.2-4.6s5.3 1.6 6.2 4.6" /></>),
  },
  {
    id: 'playback',
    label: 'Playback',
    about: 'Resuming, playlists and seeking.',
    icon: icon(<><circle cx="10" cy="10" r="7.2" /><path d="M8.4 7.1v5.8l4.6-2.9-4.6-2.9Z" /></>),
  },
  {
    id: 'audio',
    label: 'Audio',
    about: 'Volume and preferred language.',
    icon: icon(<><path d="M3.5 7.8h2.6L10 4.6v10.8l-3.9-3.2H3.5Z" /><path d="M13 7.3a3.6 3.6 0 0 1 0 5.4M15.2 5.2a6.6 6.6 0 0 1 0 9.6" /></>),
  },
  {
    id: 'subtitles',
    label: 'Subtitles',
    about: 'Automatic loading, language and online search.',
    icon: icon(<><rect x="2.8" y="4.2" width="14.4" height="11.6" rx="2" /><path d="M8.6 8.4a2 2 0 1 0 0 3.2M13.8 8.4a2 2 0 1 0 0 3.2" /></>),
  },
  {
    id: 'online',
    label: 'Online playback',
    about: 'Where downloaded parts are kept, and download servers.',
    icon: icon(<><path d="M6 15.5h8.2a3.6 3.6 0 0 0 .5-7.2 4.9 4.9 0 0 0-9.5 1.3A3 3 0 0 0 6 15.5Z" /><path d="M10 8.6v4.6m-1.9-1.8L10 13.3l1.9-1.9" /></>),
  },
  {
    id: 'about',
    label: 'About',
    about: 'Version, updates and what’s new.',
    icon: icon(<><circle cx="10" cy="10" r="7.2" /><path d="M10 9.2v4.4M10 6.6v.1" /></>),
  },
];

// Settings reopens on the tab used last, unless something asks for a particular one (showSettingsTab).
let lastTab: SettingsTab = 'account';

/** Makes the next Settings window open on this tab (e.g. "Sign in" → Account, "Check for Updates…" → About). */
export function showSettingsTab(tab: SettingsTab) {
  lastTab = tab;
}

type Props = {
  settings: Settings;
  onChange: (p: Partial<Settings>) => void;
  onClose: () => void;
  updates: UpdateState;
  onWhatsNew: () => void;
};

/** Settings, one tab per section: the tabs at the left, the chosen section at the right. */
export function SettingsDialog({ settings, onChange, onClose, updates, onWhatsNew }: Props) {
  const [tab, setTabState] = useState<SettingsTab>(lastTab);
  const setTab = (t: SettingsTab) => {
    lastTab = t;
    setTabState(t);
  };
  const current = TABS.find((t) => t.id === tab)!;
  const account = useAccount();

  return (
    <Dialog title="Settings" width={760} onClose={onClose} className="dialog--settings">
      <div className="settings">
        <nav
          className="settings__nav"
          role="tablist"
          aria-orientation="vertical"
          onKeyDown={(e) => {
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
            e.preventDefault();
            const i = TABS.findIndex((t) => t.id === tab);
            const next = Math.min(TABS.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)));
            setTab(TABS[next].id);
            (e.currentTarget.children[next] as HTMLElement | undefined)?.focus();
          }}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={t.id === tab}
              tabIndex={t.id === tab ? 0 : -1}
              className={`settings__tab ${t.id === tab ? 'is-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.icon}
              <span>{t.label}</span>
              {t.id === 'account' && account && !account.signedIn && (
                <span className="settings__dot settings__dot--warn" title="Not signed in" />
              )}
              {t.id === 'about' && updates.info?.available && <span className="settings__dot" title="Update available" />}
            </button>
          ))}
        </nav>

        <div className="settings__pane" role="tabpanel" aria-label={current.label} key={tab}>
          <div className="settings__head">
            <h3 className="settings__title">{current.label}</h3>
            <p className="settings__about">{current.about}</p>
          </div>
          {tab === 'account' && <AccountTab />}
          {tab === 'playback' && <PlaybackTab settings={settings} onChange={onChange} />}
          {tab === 'audio' && <AudioTab settings={settings} onChange={onChange} />}
          {tab === 'subtitles' && <SubtitlesTab settings={settings} onChange={onChange} />}
          {tab === 'online' && <OnlineTab settings={settings} onChange={onChange} />}
          {tab === 'about' && <AboutTab settings={settings} onChange={onChange} updates={updates} onWhatsNew={onWhatsNew} />}
        </div>
      </div>
    </Dialog>
  );
}

type TabProps = { settings: Settings; onChange: (p: Partial<Settings>) => void };

function AccountTab() {
  const account = useAccount();
  const [signingIn, setSigningIn] = useState(false);
  const signIn = async (page: 'login' | 'register') => {
    setSigningIn(true);
    await ocean?.signIn(page);
    setSigningIn(false);
  };
  return (
    <section className={`account-card ${account?.signedIn ? 'is-signed-in' : ''}`} aria-label="Film2Media account">
      <div className="account-card__head">
        <span className="account-card__avatar" aria-hidden>
          {account?.signedIn && account.user ? account.user[0].toUpperCase() : 'F2M'}
        </span>
        <div className="account-card__text">
          <div className="account-card__title">Film2Media account</div>
          <div className="account-card__status">
            {account?.signedIn ? (
              <>Signed in{account.user ? <> as <b>{account.user}</b></> : null}</>
            ) : account?.expired ? (
              'Your session ended. Sign in again to watch online.'
            ) : (
              'Not signed in'
            )}
          </div>
        </div>
      </div>
      <p className="account-card__hint">
        {account?.signedIn
          ? 'Trending titles and online playback are on.'
          : 'Sign in once to see trending titles and watch online. You sign in on the site’s own page — Ocean never sees your password.'}
      </p>
      <div className="account-card__actions">
        {account?.signedIn ? (
          <Button variant="secondary" onClick={() => ocean?.signOut()}>Sign out</Button>
        ) : (
          <>
            <Button variant="primary" disabled={signingIn || !ocean} onClick={() => signIn('login')}>
              {signingIn ? 'Waiting…' : 'Sign in'}
            </Button>
            <Button variant="secondary" disabled={signingIn || !ocean} onClick={() => signIn('register')}>
              Create account
            </Button>
            {account?.report && (
              <Button variant="ghost" onClick={() => ocean?.showItemInFolder(account.report!)}>
                Show details
              </Button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function PlaybackTab({ settings, onChange }: TabProps) {
  return (
    <>
      <Row label="Resume where I left off">
        <Toggle checked={settings.resumePlayback} onChange={(resumePlayback) => onChange({ resumePlayback })} />
      </Row>
      <Row label="Play next file in folder automatically">
        <Toggle checked={settings.autoPlayNext} onChange={(autoPlayNext) => onChange({ autoPlayNext })} />
      </Row>
      <Row label="Seek step" hint="Arrow keys">
        <Range value={settings.seekStep} min={1} max={30} step={1} onChange={(seekStep) => onChange({ seekStep })} format={(v) => `${v} s`} />
      </Row>
      <Row label="Large seek step" hint="Shift + arrow keys">
        <Range value={settings.seekStepLarge} min={10} max={300} step={5} onChange={(seekStepLarge) => onChange({ seekStepLarge })} format={(v) => `${v} s`} />
      </Row>
    </>
  );
}

function AudioTab({ settings, onChange }: TabProps) {
  return (
    <>
      <Row label="Remember volume">
        <Toggle checked={settings.rememberVolume} onChange={(rememberVolume) => onChange({ rememberVolume })} />
      </Row>
      <Row label="Maximum volume" hint="Above 100% amplifies quiet files">
        <Select
          value={settings.maxVolume}
          options={[
            { value: 1, label: '100%' },
            { value: 1.5, label: '150%' },
            { value: 2, label: '200%' },
          ]}
          onChange={(maxVolume) => onChange({ maxVolume })}
        />
      </Row>
      <Row label="Preferred audio language">
        <Select value={settings.preferredAudioLanguage} options={LANGS} onChange={(preferredAudioLanguage) => onChange({ preferredAudioLanguage })} />
      </Row>
    </>
  );
}

function SubtitlesTab({ settings, onChange }: TabProps) {
  return (
    <>
      <Row label="Load subtitles automatically" hint="Same-name files and embedded tracks">
        <Toggle checked={settings.autoLoadSubtitles} onChange={(autoLoadSubtitles) => onChange({ autoLoadSubtitles })} />
      </Row>
      <Row label="Preferred subtitle language">
        <Select value={settings.preferredSubtitleLanguage} options={LANGS} onChange={(preferredSubtitleLanguage) => onChange({ preferredSubtitleLanguage })} />
      </Row>

      <div className="section-title">Online search (OpenSubtitles.com)</div>
      <Row label="API key" hint="Free at opensubtitles.com → API consumers">
        <input
          className="input"
          style={{ width: 200 }}
          type="password"
          value={settings.openSubtitlesApiKey}
          placeholder="Paste API key"
          onChange={(e) => onChange({ openSubtitlesApiKey: e.target.value.trim() })}
        />
      </Row>
      <Row label="Search languages" hint="Comma separated codes, e.g. fa,en">
        <input className="input" style={{ width: 200 }} value={settings.subtitleLanguages} onChange={(e) => onChange({ subtitleLanguages: e.target.value })} />
      </Row>
    </>
  );
}

function OnlineTab({ settings, onChange }: TabProps) {
  const [used, setUsed] = useState<number | null>(null);
  const [cacheDir, setCacheDir] = useState<{ dir: string; isDefault: boolean } | null>(null);
  useEffect(() => {
    ocean?.cacheSize().then(setUsed);
    ocean?.cacheDir().then(setCacheDir);
  }, []);
  const refreshUsed = async () => setUsed((await ocean?.cacheSize()) ?? null);
  return (
    <>
      <div className="section-title">Cache</div>
      <Row label="Cache size limit" hint="Downloaded parts of online videos are kept so seeking back is instant">
        <Select
          value={settings.cacheLimitGb}
          options={[1, 2, 3, 5, 10, 20].map((v) => ({ value: v, label: `${v} GB` }))}
          onChange={(cacheLimitGb) => {
            onChange({ cacheLimitGb });
            ocean?.setCacheLimit(cacheLimitGb * 1024 ** 3).then(setUsed);
          }}
        />
      </Row>
      <Row label="Cache folder" hint={cacheDir?.dir}>
        <Button
          variant="secondary"
          onClick={async () => {
            const r = await ocean?.chooseCacheDir();
            if (r) setCacheDir(r);
            await refreshUsed();
          }}
        >
          Change…
        </Button>
        {cacheDir && !cacheDir.isDefault && (
          <Button
            variant="ghost"
            onClick={async () => {
              if (ocean) setCacheDir(await ocean.resetCacheDir());
              await refreshUsed();
            }}
          >
            Reset
          </Button>
        )}
      </Row>
      <Row label="In use" hint={used === null ? undefined : gb(used)}>
        <Button
          variant="secondary"
          onClick={async () => {
            await ocean?.clearCache();
            await refreshUsed();
          }}
        >
          Clear cache
        </Button>
      </Row>

      <div className="section-title">Download servers</div>
      <Row
        label="Play from servers with an expired certificate"
        hint="Only for video download servers. Nothing from your account is sent to them, and the normal check returns by itself once the site renews its certificate."
      >
        <Toggle
          checked={settings.allowExpiredCerts}
          onChange={(allowExpiredCerts) => {
            onChange({ allowExpiredCerts });
            ocean?.setAllowExpiredCerts(allowExpiredCerts);
          }}
        />
      </Row>
    </>
  );
}

function AboutTab({ settings, onChange, updates, onWhatsNew }: TabProps & { updates: UpdateState; onWhatsNew: () => void }) {
  const [version, setVersion] = useState('');
  useEffect(() => {
    ocean?.appVersion().then(setVersion);
  }, []);
  const info = updates.info;
  const updateStatus = updates.checking
    ? 'Checking…'
    : !info
      ? 'Not checked yet.'
      : !info.configured
        ? 'Updates aren’t set up yet.'
        : info.error
          ? `Couldn’t check for updates: ${info.error}.`
          : info.available
            ? `Ocean v${info.latest} is available.`
            : `You’re up to date (v${info.current}).`;
  return (
    <>
      <div className="about-row">
        <img className="about-row__logo" src={logo} width={37} height={40} alt="" />
        <div>
          <div className="about-row__name">{ABOUT.name}{version ? ` ${version}` : ''}</div>
          <div className="about-row__sub">{ABOUT.tagline}</div>
        </div>
      </div>
      <div className="about-made">
        <div>
          <div className="about-made__label">Made by</div>
          <div className="about-made__name">{ABOUT.author}</div>
        </div>
        <div className="about-made__links">
          {ABOUT.telegram && (
            <button className="social social--telegram" aria-label="Telegram" onClick={() => window.open(ABOUT.telegram)}>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden><path d="M2 8.4l13-5.2c.6-.2 1.1.1.9.9l-2.2 10.4c-.2.7-.6.9-1.2.6l-3.3-2.4-1.6 1.5c-.2.2-.3.3-.7.3l.2-3.4 6.1-5.5c.3-.2-.1-.4-.4-.2L5.2 10.1 2 9.1c-.7-.2-.7-.7.1-.7Z" fill="#fff" /></svg>
            </button>
          )}
          {ABOUT.instagram && (
            <button className="social social--instagram" aria-label="Instagram" onClick={() => window.open(ABOUT.instagram)}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden><rect x="2" y="2" width="14" height="14" rx="4" stroke="#fff" strokeWidth="1.5" /><circle cx="9" cy="9" r="3.2" stroke="#fff" strokeWidth="1.5" /><circle cx="13" cy="5" r="1" fill="#fff" /></svg>
            </button>
          )}
        </div>
      </div>
      <hr className="about-divider" />
      <Row label="What’s new" hint="See what changed in this version.">
        <Button variant="secondary" onClick={onWhatsNew}>Show</Button>
      </Row>
      <Row label="Check for updates automatically" hint="Ocean looks for new versions on GitHub and shows a message when one is ready.">
        <Toggle checked={settings.autoUpdateCheck} onChange={(autoUpdateCheck) => onChange({ autoUpdateCheck })} />
      </Row>
      <Row label="Updates" hint={updateStatus}>
        {info?.available && !updates.checking ? (
          <Button variant="primary" onClick={updates.install} disabled={!!updates.progress && !updates.progress.error}>
            Download &amp; Install
          </Button>
        ) : (
          <Button variant="secondary" disabled={updates.checking} onClick={updates.check}>
            Check now
          </Button>
        )}
      </Row>
    </>
  );
}
