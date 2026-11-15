import { useEffect, useState } from 'react';
import { ocean } from './bridge';

const known = new Map<string, number | null>();

export function formatSize(bytes: number | null | undefined) {
  if (!bytes) return undefined;
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(bytes >= 10 * 1024 ** 3 ? 0 : 1)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

export type SizeState = { state: 'loading' } | { state: 'unknown' } | { state: 'known'; text: string };

/** Links whose size could not be read are asked again after this long (the server may be back). */
const RETRY_UNKNOWN_MS = 60_000;
const failedAt = new Map<string, number>();
const isMissing = (u: string) => !known.has(u) || (known.get(u) == null && Date.now() - (failedAt.get(u) ?? 0) > RETRY_UNKNOWN_MS);

/** File sizes for download links, fetched once per link and shared across components. */
export function useSizes(urls: string[]) {
  const key = urls.join('\n');
  const [, setTick] = useState(0);
  const [pending, setPending] = useState<Set<string>>(new Set());
  useEffect(() => {
    const missing = urls.filter(isMissing);
    if (!missing.length || !ocean) return;
    let alive = true;
    setPending(new Set(missing));
    ocean
      .sourceSizes(missing)
      .then((r) => {
        for (const [u, s] of Object.entries(r)) {
          known.set(u, s);
          if (s == null) failedAt.set(u, Date.now());
        }
      })
      .catch(() => missing.forEach((u) => (known.set(u, null), failedAt.set(u, Date.now()))))
      .finally(() => {
        if (!alive) return;
        setPending(new Set());
        setTick((t) => t + 1);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (url: string): SizeState => {
    if (pending.has(url) || !known.has(url)) return { state: 'loading' };
    const text = formatSize(known.get(url));
    return text ? { state: 'known', text } : { state: 'unknown' };
  };
}
