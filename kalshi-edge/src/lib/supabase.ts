import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Alert, AlertCondition, Profile, WatchlistItem } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Persist the auth session in chrome.storage.local so it survives across
// the popup, content script, and service worker contexts.
const chromeStorageAdapter = {
  getItem: (key: string): Promise<string | null> =>
    new Promise((resolve) =>
      chrome.storage.local.get(key, (res) => resolve(res[key] ?? null)),
    ),
  setItem: (key: string, value: string): Promise<void> =>
    new Promise((resolve) => chrome.storage.local.set({ [key]: value }, () => resolve())),
  removeItem: (key: string): Promise<void> =>
    new Promise((resolve) => chrome.storage.local.remove(key, () => resolve())),
};

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: chromeStorageAdapter,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data as Profile;
}

export async function isPro(userId: string): Promise<boolean> {
  const profile = await getProfile(userId);
  if (!profile || profile.plan !== 'pro') return false;
  if (profile.plan_expires_at && new Date(profile.plan_expires_at) < new Date()) return false;
  return true;
}

// ---- Watchlist ----

export async function getWatchlistRemote(userId: string): Promise<WatchlistItem[]> {
  const { data, error } = await supabase
    .from('watchlist')
    .select('*')
    .eq('user_id', userId)
    .order('added_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as WatchlistItem[];
}

export async function addWatchlistRemote(
  userId: string,
  ticker: string,
  title: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('watchlist')
    .upsert({ user_id: userId, ticker, title }, { onConflict: 'user_id,ticker' });
  if (error) throw error;
}

export async function removeWatchlistRemote(userId: string, ticker: string): Promise<void> {
  const { error } = await supabase
    .from('watchlist')
    .delete()
    .eq('user_id', userId)
    .eq('ticker', ticker);
  if (error) throw error;
}

// ---- Alerts (pro) ----

export async function getAlertsRemote(userId: string): Promise<Alert[]> {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Alert[];
}

export async function getActiveAlertsRemote(userId: string): Promise<Alert[]> {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('user_id', userId)
    .eq('triggered', false);
  if (error) throw error;
  return (data ?? []) as Alert[];
}

export async function createAlertRemote(
  userId: string,
  alert: { ticker: string; title: string | null; condition: AlertCondition; threshold: number },
): Promise<void> {
  const { error } = await supabase.from('alerts').insert({
    user_id: userId,
    ticker: alert.ticker,
    title: alert.title,
    condition: alert.condition,
    threshold: alert.threshold,
  });
  if (error) throw error;
}

export async function deleteAlertRemote(id: string): Promise<void> {
  const { error } = await supabase.from('alerts').delete().eq('id', id);
  if (error) throw error;
}

export async function setAlertTriggered(id: string, triggered: boolean): Promise<void> {
  const { error } = await supabase.from('alerts').update({ triggered }).eq('id', id);
  if (error) throw error;
}
