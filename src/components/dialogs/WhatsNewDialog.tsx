import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import logo from '../../assets/logo.svg';
import { GITHUB_REPO } from '../../../shared/app';
import { ocean } from '../../lib/bridge';
import { releasesSince, type ChangeKind, type Release } from '../../lib/changelog';
import { CloseIcon } from '../icons';

const LABEL: Record<ChangeKind, string> = { new: 'New', improved: 'Improved', fixed: 'Fixed' };
const ORDER: ChangeKind[] = ['new', 'improved', 'fixed'];

const KIND_ICON: Record<ChangeKind, JSX.Element> = {
  new: (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M10 1.8l1.9 4.9 5.1.4-3.9 3.3 1.2 5-4.3-2.7-4.3 2.7 1.2-5L3 7.1l5.1-.4L10 1.8Z" />
    </svg>
  ),
  improved: (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 13.5 8 8.5l3 3 6-6.5M12.5 5H17v4.5" />
    </svg>
  ),
  fixed: (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4.5 10.5 8.3 14 15.5 6" />
    </svg>
  ),
};

const niceDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(+d) ? iso : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

/**
 * "What's new" after an update (and from Settings). Shows the bundled changelog for every version since the one the
 * user had; falls back to the GitHub release notes when this version has no bundled entry.
 */
export function WhatsNewDialog({ since = null, afterUpdate = false, onClose }: { since?: string | null; afterUpdate?: boolean; onClose: () => void }) {
  const [version, setVersion] = useState('');
  const [remote, setRemote] = useState<string | null>(null);
  useEffect(() => {
    ocean?.appVersion().then(setVersion);
  }, []);
  const releases: Release[] = version ? releasesSince(version, since) : [];
  useEffect(() => {
    if (version && !releases.length) ocean?.releaseNotes().then((r) => setRemote(r.notes || ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const top = releases[0];
  return createPortal(
    <div className="dialog-layer dialog-layer--modal" onMouseDown={onClose}>
      <section className="wn" role="dialog" aria-label="What’s new" onMouseDown={(e) => e.stopPropagation()}>
        <header className="wn__hero">
          <div className="wn__glow" aria-hidden />
          <img className="wn__logo" src={logo} alt="" />
          <div className="wn__heading">
            <div className="wn__kicker">{afterUpdate ? 'Ocean was updated' : 'Ocean Player'}</div>
            <h2 className="wn__title">What’s new</h2>
            <div className="wn__meta">
              {version && <span className="wn__pill">Version {version}</span>}
              {top && <span className="wn__date">{niceDate(top.date)}</span>}
            </div>
          </div>
          <button className="wn__close" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>

        <div className="wn__body">
          {releases.map((r, ri) => (
            <div key={r.version} className="wn__release">
              {releases.length > 1 && (
                <div className="wn__rhead">
                  <span>{ri === 0 ? `This version · ${r.version}` : `Also since your last update · ${r.version}`}</span>
                </div>
              )}
              {ORDER.filter((k) => r.items.some((it) => it.kind === k)).map((k) => (
                <div key={k} className={`wn__group wn__group--${k}`}>
                  <div className="wn__label">
                    {KIND_ICON[k]}
                    {LABEL[k]}
                  </div>
                  <ul className="wn__list">
                    {r.items
                      .filter((it) => it.kind === k)
                      .map((it, i) => (
                        <li key={i}>{it.text}</li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
          {!releases.length && version && (
            <div className="wn__remote">
              {remote === null ? (
                <p>Loading…</p>
              ) : remote ? (
                remote
                  .split('\n')
                  .map((l) => l.trim())
                  .filter((l) => l && !/^#/.test(l))
                  .map((l, i) => <p key={i}>{l.replace(/^[-*]\s+/, '• ')}</p>)
              ) : (
                <p>No release notes were published for this version.</p>
              )}
            </div>
          )}
        </div>

        <footer className="wn__foot">
          <button className="wn__link" onClick={() => window.open(`https://github.com/${GITHUB_REPO}/releases`)}>
            All release notes
          </button>
          <button className="btn btn--primary wn__ok" onClick={onClose} autoFocus>
            Got it
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
