// Shared types across the extension.

export interface Market {
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
  // Kalshi returns the parent series ticker; useful for candlestick lookups.
  series_ticker?: string;
  event_ticker?: string;
}

export interface Candlestick {
  // Unix timestamp (seconds) for the start of the period.
  ts: number;
  // Yes price (cents) — we surface the period close for charting.
  yes_price: number;
  yes_open: number;
  yes_high: number;
  yes_low: number;
  yes_close: number;
  volume: number;
}

export interface OrderbookLevel {
  price: number;
  quantity: number;
}

export interface Orderbook {
  yes: OrderbookLevel[];
  no: OrderbookLevel[];
}

export type Plan = 'free' | 'pro';

export interface Profile {
  id: string;
  email: string | null;
  stripe_customer_id: string | null;
  plan: Plan;
  plan_expires_at: string | null;
  created_at: string;
}

export interface WatchlistItem {
  id?: string;
  user_id?: string;
  ticker: string;
  title: string | null;
  added_at?: string;
}

export type AlertCondition = 'above' | 'below';

export interface Alert {
  id?: string;
  user_id?: string;
  ticker: string;
  title: string | null;
  condition: AlertCondition;
  threshold: number; // 0-99 cents
  triggered: boolean;
  // Local-only UI flag for enable/disable toggling.
  enabled?: boolean;
  created_at?: string;
}

export const FREE_WATCHLIST_LIMIT = 5;
