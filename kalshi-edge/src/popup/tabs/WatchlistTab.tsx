import { useCallback, useEffect, useState } from 'react';
import { Search, Trash2, Plus, Loader2, Star } from 'lucide-react';
import { getMarket, getMarkets, getCandlesticks } from '../../lib/kalshi';
import {
  getWatchlistRemote,
  addWatchlistRemote,
  removeWatchlistRemote,
} from '../../lib/supabase';
import {
  getLocalWatchlist,
  addLocalWatchlist,
  removeLocalWatchlist,
} from '../../lib/storage';
import { FREE_WATCHLIST_LIMIT, type Market, type WatchlistItem } from '../../types';

interface Row extends WatchlistItem {
  price: number | null;
  change: number | null; // 24h change in cents
}

const DAY_SECONDS = 24 * 60 * 60;

async function loadPrice(ticker: string): Promise<{ price: number | null; change: number | null }> {
  const endTs = Math.floor(Date.now() / 1000);
  const startTs = endTs - DAY_SECONDS;
  const [market, candles] = await Promise.all([
    getMarket(ticker).catch(() => null),
    getCandlesticks(ticker, ticker.split('-')[0], startTs, endTs, 60).catch(() => []),
  ]);
  const price = market?.yes_bid ?? null;
  let change: number | null = null;
  if (candles.length >= 2 && price != null) {
    change = price - candles[0].yes_close;
  }
  return { price, change };
}

export function WatchlistTab({ userId, pro }: { userId: string | null; pro: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Market[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const items = userId ? await getWatchlistRemote(userId).catch(() => []) : await getLocalWatchlist();
    const withPrices = await Promise.all(
      items.map(async (i) => ({ ...i, ...(await loadPrice(i.ticker)) })),
    );
    setRows(withPrices);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const atLimit = !pro && rows.length >= FREE_WATCHLIST_LIMIT;

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const markets = await getMarkets({ limit: 100, status: 'open' });
      const q = query.trim().toLowerCase();
      setResults(
        markets
          .filter((m) => m.title.toLowerCase().includes(q) || m.ticker.toLowerCase().includes(q))
          .slice(0, 8),
      );
    } finally {
      setSearching(false);
    }
  }

  async function add(market: Market) {
    if (atLimit) return;
    if (userId) await addWatchlistRemote(userId, market.ticker, market.title);
    else await addLocalWatchlist(market.ticker, market.title);
    setResults([]);
    setQuery('');
    await load();
  }

  async function remove(ticker: string) {
    if (userId) await removeWatchlistRemote(userId, ticker);
    else await removeLocalWatchlist(ticker);
    setRows((r) => r.filter((x) => x.ticker !== ticker));
  }

  function openMarket(item: WatchlistItem) {
    const series = item.ticker.split('-')[0];
    chrome.tabs.create({ url: `https://kalshi.com/markets/${series}/${item.ticker}` });
  }

  return (
    <div className="p-3">
      <form onSubmit={search} className="mb-3 flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-md bg-kalshi-panel px-2 ring-1 ring-kalshi-border">
          <Search size={14} className="text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Add a market…"
            className="flex-1 bg-transparent py-2 text-sm outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={searching}
          className="rounded-md bg-kalshi-yes px-3 text-sm font-medium text-slate-900 hover:opacity-90"
        >
          {searching ? <Loader2 className="animate-spin" size={14} /> : 'Search'}
        </button>
      </form>

      {results.length > 0 && (
        <div className="mb-3 space-y-1 rounded-md bg-kalshi-panel p-2 ring-1 ring-kalshi-border">
          {results.map((m) => (
            <button
              key={m.ticker}
              onClick={() => add(m)}
              disabled={atLimit}
              className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-kalshi-border disabled:opacity-40"
            >
              <span className="truncate">{m.title}</span>
              <Plus size={14} className="shrink-0 text-kalshi-yes" />
            </button>
          ))}
          {atLimit && (
            <p className="px-2 pt-1 text-[10px] text-slate-500">Free limit reached — upgrade to add more.</p>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8 text-slate-400">
          <Loader2 className="animate-spin" size={18} />
        </div>
      ) : rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">
          <Star className="mx-auto mb-2 text-slate-600" size={24} />
          No markets yet. Search above to add one.
        </div>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li
              key={r.ticker}
              className="group flex items-center justify-between gap-2 rounded-md bg-kalshi-panel px-3 py-2 ring-1 ring-kalshi-border"
            >
              <button onClick={() => openMarket(r)} className="min-w-0 flex-1 text-left">
                <div className="truncate text-xs font-medium">{r.title ?? r.ticker}</div>
                <div className="font-mono text-[10px] text-slate-500">{r.ticker}</div>
              </button>
              <div className="shrink-0 text-right">
                <div className="text-sm font-semibold">{r.price != null ? `${r.price}¢` : '—'}</div>
                {r.change != null && (
                  <div className={`text-[10px] ${r.change >= 0 ? 'text-kalshi-yes' : 'text-kalshi-no'}`}>
                    {r.change >= 0 ? '▲' : '▼'} {Math.abs(r.change)}¢
                  </div>
                )}
              </div>
              <button
                onClick={() => remove(r.ticker)}
                className="text-slate-600 opacity-0 transition group-hover:opacity-100 hover:text-kalshi-no"
                title="Remove"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!pro && (
        <div className="mt-3 rounded-md border border-dashed border-kalshi-border p-2 text-center text-[11px] text-slate-400">
          {rows.length}/{FREE_WATCHLIST_LIMIT} free slots used · upgrade to Pro for unlimited
        </div>
      )}
    </div>
  );
}
