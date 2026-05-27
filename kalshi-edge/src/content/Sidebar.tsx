import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Star, Lock, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { getMarket, getCandlesticks } from '../lib/kalshi';
import {
  getCurrentUserId,
  isPro,
  getWatchlistRemote,
  addWatchlistRemote,
  removeWatchlistRemote,
} from '../lib/supabase';
import {
  getLocalWatchlist,
  addLocalWatchlist,
  removeLocalWatchlist,
} from '../lib/storage';
import { FREE_WATCHLIST_LIMIT, type Candlestick, type Market } from '../types';

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

// Parse the ticker (and series) from a Kalshi market URL:
// kalshi.com/markets/{series}/{ticker}
function parseTickerFromUrl(): { series: string; ticker: string } | null {
  const match = window.location.pathname.match(/\/markets\/([^/]+)\/([^/?#]+)/);
  if (!match) return null;
  return { series: match[1].toUpperCase(), ticker: match[2].toUpperCase() };
}

function formatCountdown(closeTime: string): string {
  const close = new Date(closeTime).getTime();
  const diff = close - Date.now();
  if (diff <= 0) return 'Closed';
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  return `${days}d ${hours}h`;
}

export default function Sidebar() {
  const [open, setOpen] = useState(true);
  const [route, setRoute] = useState(parseTickerFromUrl());
  const [market, setMarket] = useState<Market | null>(null);
  const [candles, setCandles] = useState<Candlestick[]>([]);
  const [loading, setLoading] = useState(false);
  const [watched, setWatched] = useState(false);
  const [watchCount, setWatchCount] = useState(0);
  const [pro, setPro] = useState(false);
  const [busy, setBusy] = useState(false);

  // Watch SPA navigation — Kalshi is a single-page app, so the URL can change
  // without a reload.
  useEffect(() => {
    let last = window.location.href;
    const interval = setInterval(() => {
      if (window.location.href !== last) {
        last = window.location.href;
        setRoute(parseTickerFromUrl());
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Adjust page layout so the sidebar doesn't overlap content.
  useEffect(() => {
    document.body.style.transition = 'margin-right 0.2s ease';
    document.body.style.marginRight = open ? '320px' : '0px';
    return () => {
      document.body.style.marginRight = '0px';
    };
  }, [open]);

  // Load market + candlestick data when the ticker changes.
  useEffect(() => {
    if (!route) {
      setMarket(null);
      setCandles([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const m = await getMarket(route.ticker);
        if (cancelled) return;
        setMarket(m);
        if (m) {
          const endTs = Math.floor(Date.now() / 1000);
          const startTs = endTs - SEVEN_DAYS_SECONDS;
          const series = m.series_ticker ?? route.series;
          // 60-minute candles over 7 days.
          const cs = await getCandlesticks(route.ticker, series, startTs, endTs, 60);
          if (!cancelled) setCandles(cs);
        }
      } catch (err) {
        console.error('[KalshiEdge] failed to load market', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [route?.ticker]);

  // Determine watch state + plan + count.
  useEffect(() => {
    if (!route) return;
    let cancelled = false;
    (async () => {
      const userId = await getCurrentUserId();
      if (userId) {
        const [items, isProUser] = await Promise.all([
          getWatchlistRemote(userId).catch(() => []),
          isPro(userId).catch(() => false),
        ]);
        if (cancelled) return;
        setPro(isProUser);
        setWatchCount(items.length);
        setWatched(items.some((i) => i.ticker === route.ticker));
      } else {
        const items = await getLocalWatchlist();
        if (cancelled) return;
        setPro(false);
        setWatchCount(items.length);
        setWatched(items.some((i) => i.ticker === route.ticker));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [route?.ticker]);

  const atFreeLimit = !pro && !watched && watchCount >= FREE_WATCHLIST_LIMIT;

  const chartData = useMemo(
    () =>
      candles.map((c) => ({
        time: new Date(c.ts * 1000).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        }),
        price: c.yes_close,
      })),
    [candles],
  );

  async function toggleWatch() {
    if (!route || busy || atFreeLimit) return;
    setBusy(true);
    try {
      const userId = await getCurrentUserId();
      const title = market?.title ?? null;
      if (watched) {
        if (userId) await removeWatchlistRemote(userId, route.ticker);
        else await removeLocalWatchlist(route.ticker);
        setWatched(false);
        setWatchCount((c) => Math.max(0, c - 1));
      } else {
        if (userId) await addWatchlistRemote(userId, route.ticker, title);
        else await addLocalWatchlist(route.ticker, title);
        setWatched(true);
        setWatchCount((c) => c + 1);
      }
    } catch (err) {
      console.error('[KalshiEdge] watchlist toggle failed', err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Floating toggle on the right edge */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed top-1/2 right-0 z-[2147483647] -translate-y-1/2 rounded-l-md bg-kalshi-panel p-2 text-white shadow-lg ring-1 ring-kalshi-border hover:bg-kalshi-border"
        style={{ transform: `translateY(-50%) translateX(${open ? '-320px' : '0'})`, transition: 'transform 0.2s ease' }}
        title="Toggle KalshiEdge"
      >
        {open ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>

      <div
        className="fixed top-0 right-0 z-[2147483646] h-full w-[320px] overflow-y-auto bg-kalshi-bg text-white shadow-2xl ring-1 ring-kalshi-border"
        style={{ transform: open ? 'translateX(0)' : 'translateX(320px)', transition: 'transform 0.2s ease' }}
      >
        <div className="flex items-center justify-between border-b border-kalshi-border px-4 py-3">
          <span className="text-sm font-bold tracking-wide text-kalshi-yes">KalshiEdge</span>
          <span className="text-[10px] uppercase text-slate-400">{pro ? 'Pro' : 'Free'}</span>
        </div>

        {!route && (
          <div className="p-4 text-sm text-slate-400">
            Open a Kalshi market page to see charts, info, and watchlist controls.
          </div>
        )}

        {route && loading && (
          <div className="flex items-center gap-2 p-4 text-sm text-slate-400">
            <Loader2 className="animate-spin" size={16} /> Loading {route.ticker}…
          </div>
        )}

        {route && !loading && !market && (
          <div className="p-4 text-sm text-slate-400">
            Couldn’t find market <span className="font-mono">{route.ticker}</span>.
          </div>
        )}

        {route && !loading && market && (
          <div className="space-y-5 p-4">
            <div>
              <h2 className="text-sm font-semibold leading-snug">{market.title}</h2>
              <p className="mt-0.5 font-mono text-[11px] text-slate-500">{market.ticker}</p>
            </div>

            {/* Price chart */}
            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                Yes price · 7d
              </h3>
              {chartData.length > 0 ? (
                <div className="h-32 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                      <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#94a3b8' }} interval="preserveStartEnd" />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} width={28} />
                      <Tooltip
                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', fontSize: 11 }}
                        labelStyle={{ color: '#94a3b8' }}
                        formatter={(v: number) => [`${v}¢`, 'Yes']}
                      />
                      <Line type="monotone" dataKey="price" stroke="#22c55e" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-slate-500">No price history available.</p>
              )}
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-kalshi-yes">Bid {market.yes_bid}¢</span>
                <span className="text-slate-400">
                  Spread {Math.max(0, market.yes_ask - market.yes_bid)}¢
                </span>
                <span className="text-kalshi-no">Ask {market.yes_ask}¢</span>
              </div>
            </section>

            {/* Market info */}
            <section className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Closes in" value={formatCountdown(market.close_time)} />
              <Stat label="Open int." value={market.open_interest.toLocaleString()} />
              <Stat label="Volume" value={market.volume.toLocaleString()} />
            </section>

            {/* Watchlist toggle */}
            <section>
              {atFreeLimit ? (
                <button
                  disabled
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-kalshi-panel px-3 py-2 text-xs text-slate-400 ring-1 ring-kalshi-border"
                >
                  <Lock size={14} /> Pro — upgrade to unlock more
                </button>
              ) : (
                <button
                  onClick={toggleWatch}
                  disabled={busy}
                  className={`flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition ${
                    watched
                      ? 'bg-kalshi-panel text-slate-200 ring-1 ring-kalshi-border hover:bg-kalshi-border'
                      : 'bg-kalshi-yes text-slate-900 hover:opacity-90'
                  }`}
                >
                  {busy ? <Loader2 className="animate-spin" size={14} /> : <Star size={14} fill={watched ? 'currentColor' : 'none'} />}
                  {watched ? 'Remove from Watchlist' : 'Add to Watchlist'}
                </button>
              )}
              {!pro && (
                <p className="mt-1 text-center text-[10px] text-slate-500">
                  {watchCount}/{FREE_WATCHLIST_LIMIT} free watchlist slots used
                </p>
              )}
            </section>
          </div>
        )}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-kalshi-panel px-2 py-2 ring-1 ring-kalshi-border">
      <div className="text-[10px] uppercase text-slate-500">{label}</div>
      <div className="mt-0.5 text-xs font-semibold">{value}</div>
    </div>
  );
}
