import type { Candlestick, Market, Orderbook } from '../types';

const BASE_URL = 'https://api.kalshi.com/trade-api/v2';

class KalshiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'KalshiError';
  }
}

// Centralized fetch: returns null on 404, throws on 5xx (and other non-OK).
async function request<T>(path: string): Promise<T | null> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new KalshiError(res.status, `Kalshi API ${res.status} on ${path}`);
  }
  return (await res.json()) as T;
}

interface RawMarket {
  ticker: string;
  title: string;
  yes_bid: number;
  yes_ask: number;
  last_price: number;
  volume: number;
  open_interest: number;
  close_time: string;
  status: string;
  result: string;
  series_ticker?: string;
  event_ticker?: string;
}

function normalizeMarket(m: RawMarket): Market {
  return {
    ticker: m.ticker,
    title: m.title,
    yes_bid: m.yes_bid ?? 0,
    yes_ask: m.yes_ask ?? 0,
    last_price: m.last_price ?? 0,
    volume: m.volume ?? 0,
    open_interest: m.open_interest ?? 0,
    close_time: m.close_time,
    status: m.status,
    result: m.result ?? '',
    series_ticker: m.series_ticker,
    event_ticker: m.event_ticker,
  };
}

// GET /trade-api/v2/markets/{ticker}
export async function getMarket(ticker: string): Promise<Market | null> {
  const data = await request<{ market: RawMarket }>(`/markets/${encodeURIComponent(ticker)}`);
  return data ? normalizeMarket(data.market) : null;
}

// GET /trade-api/v2/markets
export async function getMarkets(params: {
  limit?: number;
  cursor?: string;
  status?: string;
} = {}): Promise<Market[]> {
  const qs = new URLSearchParams();
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.cursor) qs.set('cursor', params.cursor);
  if (params.status) qs.set('status', params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';

  const data = await request<{ markets: RawMarket[] }>(`/markets${suffix}`);
  return data ? data.markets.map(normalizeMarket) : [];
}

interface RawCandlestick {
  end_period_ts: number;
  price?: { open?: number; high?: number; low?: number; close?: number; mean?: number };
  yes_bid?: { open?: number; high?: number; low?: number; close?: number };
  yes_ask?: { open?: number; high?: number; low?: number; close?: number };
  volume?: number;
}

// GET /trade-api/v2/series/{series_ticker}/markets/{ticker}/candlesticks
export async function getCandlesticks(
  ticker: string,
  seriesTicker: string,
  startTs: number,
  endTs: number,
  periodInterval: number,
): Promise<Candlestick[]> {
  const qs = new URLSearchParams({
    start_ts: String(startTs),
    end_ts: String(endTs),
    period_interval: String(periodInterval),
  });
  const path = `/series/${encodeURIComponent(seriesTicker)}/markets/${encodeURIComponent(
    ticker,
  )}/candlesticks?${qs.toString()}`;

  const data = await request<{ candlesticks: RawCandlestick[] }>(path);
  if (!data) return [];

  return data.candlesticks.map((c) => {
    const close = c.price?.close ?? c.price?.mean ?? c.yes_bid?.close ?? 0;
    return {
      ts: c.end_period_ts,
      yes_price: close,
      yes_open: c.price?.open ?? close,
      yes_high: c.price?.high ?? close,
      yes_low: c.price?.low ?? close,
      yes_close: close,
      volume: c.volume ?? 0,
    };
  });
}

// GET /trade-api/v2/markets/{ticker}/orderbook
export async function getOrderbook(ticker: string): Promise<Orderbook | null> {
  const data = await request<{ orderbook: { yes?: [number, number][]; no?: [number, number][] } }>(
    `/markets/${encodeURIComponent(ticker)}/orderbook`,
  );
  if (!data) return null;

  const toLevels = (rows: [number, number][] | undefined) =>
    (rows ?? []).map(([price, quantity]) => ({ price, quantity }));

  return {
    yes: toLevels(data.orderbook.yes),
    no: toLevels(data.orderbook.no),
  };
}

export { KalshiError };
