import { useEffect, useMemo, useState } from 'react';
import { compareSources, GROUP_LABEL, pickSource, type OnlineDetails, type OnlineSource, type OnlineTitle, type SourcePref } from '../../../shared/media';
import { ocean } from '../../lib/bridge';
import { toggleBookmark, useBookmarks } from '../../lib/bookmarks';
import { useSizes } from '../../lib/sizes';
import { Button, Dialog } from '../ui';

type Props = {
  title: OnlineTitle;
  details: OnlineDetails | null;
  error: string | null;
  /** Episode to preselect (last watched), index into details.episodes. */
  initialEpisode: number;
  pref?: SourcePref;
  onPlay: (episode: number, source: OnlineSource) => void;
  onRetry: () => void;
  onClose: () => void;
};

const two = (n: number) => String(n).padStart(2, '0');

/** Shown before playing a title from the home slider: season / episode, version (dub / subtitle) and quality. */
export function OnlinePickerDialog(p: Props) {
  const d = p.details;
  const isSeries = !!d?.episodes.length;
  const [episode, setEpisode] = useState(p.initialEpisode);
  const [selected, setSelected] = useState<OnlineSource | null>(null);

  useEffect(() => setEpisode(p.initialEpisode), [p.initialEpisode, d]);

  const sources = useMemo(
    () => (d ? [...(isSeries ? (d.episodes[episode]?.sources ?? []) : d.sources)].sort(compareSources) : []),
    [d, isSeries, episode],
  );

  // Keep the chosen version + quality when switching episodes; default to the lowest quality.
  useEffect(() => {
    if (!sources.length) return setSelected(null);
    setSelected((cur) => pickSource(sources, cur ?? p.pref));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources]);

  const sizeOf = useSizes(sources.map((s) => s.url));
  const groups = [...new Set(sources.map((s) => s.group))];
  const group = selected?.group ?? groups[0];
  const seasons = d ? [...new Set(d.episodes.map((e) => e.season))] : [];
  const season = d?.episodes[episode]?.season ?? seasons[0];
  // IMDb score: the site's own, else the OMDb lookup (cached, same as the home posters).
  const siteScore = d?.title.imdb ?? p.title.imdb;
  const [omdb, setOmdb] = useState<string | null>(null);
  useEffect(() => {
    setOmdb(null);
    if (siteScore || !ocean) return;
    let live = true;
    ocean.imdbRatings([p.title]).then((r) => live && setOmdb(r[p.title.id] ?? null)).catch(() => {});
    return () => {
      live = false;
    };
  }, [p.title, siteScore]);
  const score = siteScore ?? omdb;
  const bookmarks = useBookmarks();
  const marked = bookmarks.some((b) => b.id === p.title.id);

  const poster = p.title.poster ? (ocean ? `ocean-img://i/?u=${encodeURIComponent(p.title.poster)}` : p.title.poster) : '';

  return (
    <Dialog
      title={isSeries ? 'Choose episode & quality' : 'Choose quality'}
      width={620}
      onClose={p.onClose}
      footer={
        <>
          <Button variant="ghost" onClick={p.onClose}>Cancel</Button>
          <Button variant="primary" disabled={!selected} onClick={() => selected && p.onPlay(episode, selected)}>
            ▶ Play{isSeries && d?.episodes[episode] ? ` S${two(d.episodes[episode].season)}E${two(d.episodes[episode].episode)}` : ''}
          </Button>
        </>
      }
    >
      <div className="picker">
        <div className="picker__head">
          {poster && <img className="picker__poster" src={poster} alt="" />}
          <div className="picker__info">
            <div className="picker__title" dir="auto">{p.title.title}</div>
            <div className="picker__meta">{[p.title.kind === 'series' ? 'Series' : 'Movie', p.title.year].filter(Boolean).join(' · ')}</div>
            <div className="picker__actions">
              {score && (
                <span className="picker__imdb" title="IMDb rating">
                  <span className="imdb">IMDb</span>
                  <span className="picker__score">{score}</span>
                  <span className="picker__of">/10</span>
                </span>
              )}
              <button
                className={`picker__mark ${marked ? 'is-on' : ''}`}
                aria-pressed={marked}
                onClick={() => toggleBookmark(p.title)}
              >
                <svg width="14" height="16" viewBox="0 0 16 18" aria-hidden>
                  <path d="M2.5 1.75h11a.75.75 0 0 1 .75.75v13.6a.5.5 0 0 1-.8.4L8 12.4l-5.45 4.1a.5.5 0 0 1-.8-.4V2.5a.75.75 0 0 1 .75-.75Z" fill={marked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
                {marked ? 'Bookmarked' : 'Bookmark'}
              </button>
            </div>
          </div>
        </div>

        {!d && !p.error && (
          <div className="picker__loading">
            <span className="picker__spinner" /> Loading links…
          </div>
        )}
        {p.error && (() => {
          // "[file:<path>]" points at the page the site returned, saved for diagnosis.
          const file = /\[file:(.+?)\]$/.exec(p.error)?.[1];
          return (
            <div className="picker__error">
              <span>{p.error.replace(/\s*\[file:.+?\]$/, '')}</span>
              <span className="picker__actions">
                {file && (
                  <Button variant="ghost" onClick={() => ocean?.showItemInFolder(file)}>
                    Show file
                  </Button>
                )}
                <Button variant="secondary" onClick={p.onRetry}>Retry</Button>
              </span>
            </div>
          );
        })()}

        {d && isSeries && (
          <>
            <div className="section-title">Season</div>
            <div className="picker__chips">
              {seasons.map((s) => (
                <button
                  key={s}
                  className={`chip ${s === season ? 'is-on' : ''}`}
                  onClick={() => setEpisode(d.episodes.findIndex((e) => e.season === s))}
                >
                  Season {s}
                </button>
              ))}
            </div>
            <div className="section-title">Episode</div>
            <div className="picker__episodes">
              {d.episodes.map((e, i) =>
                e.season === season ? (
                  <button key={i} className={`picker__ep ${i === episode ? 'is-on' : ''}`} onClick={() => setEpisode(i)}>
                    {two(e.episode)}
                  </button>
                ) : null,
              )}
            </div>
          </>
        )}

        {d && sources.length > 0 && (
          <>
            {groups.length > 1 && (
              <>
                <div className="section-title">Version</div>
                <div className="picker__chips">
                  {groups.map((g) => (
                    <button
                      key={g}
                      className={`chip chip--fa ${g === group ? 'is-on' : ''}`}
                      onClick={() => setSelected(pickSource(sources.filter((s) => s.group === g), selected ?? undefined))}
                    >
                      {GROUP_LABEL[g]}
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="section-title">Quality</div>
            <ul className="picker__qualities">
              {sources
                .filter((s) => s.group === group)
                .map((s) => (
                  <li key={s.url}>
                    <button className={`picker__q ${selected?.url === s.url ? 'is-on' : ''}`} onClick={() => setSelected(s)}>
                      <span className="picker__radio" />
                      <span className="picker__qlabel">{s.label}</span>
                      <span className="picker__qsize">{sizeOf(s.url)}</span>
                    </button>
                  </li>
                ))}
            </ul>
          </>
        )}
        {d && !sources.length && <div className="picker__error">No playable links for this episode.</div>}
      </div>
    </Dialog>
  );
}
