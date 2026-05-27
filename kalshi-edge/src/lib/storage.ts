import type { WatchlistItem } from '../types';

// Local (logged-out) fallback storage. Watchlist lives in chrome.storage.local
// keyed under a single array so it round-trips with the Supabase shape.

const WATCHLIST_KEY = 'local_watchlist';

export function getLocalWatchlist(): Promise<WatchlistItem[]> {
  return new Promise((resolve) =>
    chrome.storage.local.get(WATCHLIST_KEY, (res) =>
      resolve((res[WATCHLIST_KEY] as WatchlistItem[]) ?? []),
    ),
  );
}

function setLocalWatchlist(items: WatchlistItem[]): Promise<void> {
  return new Promise((resolve) =>
    chrome.storage.local.set({ [WATCHLIST_KEY]: items }, () => resolve()),
  );
}

export async function addLocalWatchlist(ticker: string, title: string | null): Promise<void> {
  const items = await getLocalWatchlist();
  if (items.some((i) => i.ticker === ticker)) return;
  items.push({ ticker, title, added_at: new Date().toISOString() });
  await setLocalWatchlist(items);
}

export async function removeLocalWatchlist(ticker: string): Promise<void> {
  const items = await getLocalWatchlist();
  await setLocalWatchlist(items.filter((i) => i.ticker !== ticker));
}

export async function isInLocalWatchlist(ticker: string): Promise<boolean> {
  const items = await getLocalWatchlist();
  return items.some((i) => i.ticker === ticker);
}

// Per-alert enable/disable state lives locally (the schema has no column for it).
const DISABLED_ALERTS_KEY = 'disabled_alerts';

export function getDisabledAlertIds(): Promise<string[]> {
  return new Promise((resolve) =>
    chrome.storage.local.get(DISABLED_ALERTS_KEY, (res) =>
      resolve((res[DISABLED_ALERTS_KEY] as string[]) ?? []),
    ),
  );
}

export async function setAlertEnabled(id: string, enabled: boolean): Promise<void> {
  const disabled = await getDisabledAlertIds();
  const next = enabled ? disabled.filter((d) => d !== id) : [...new Set([...disabled, id])];
  return new Promise((resolve) =>
    chrome.storage.local.set({ [DISABLED_ALERTS_KEY]: next }, () => resolve()),
  );
}
