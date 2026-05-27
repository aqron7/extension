import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Star, Bell, User as UserIcon, Loader2, LogOut } from 'lucide-react';
import { supabase, getProfile, isPro } from '../lib/supabase';
import { openCheckout } from '../lib/stripe';
import { WatchlistTab } from './tabs/WatchlistTab';
import { AlertsTab } from './tabs/AlertsTab';
import type { Plan } from '../types';

type Tab = 'watchlist' | 'alerts' | 'account';

export default function Popup() {
  const [tab, setTab] = useState<Tab>('watchlist');
  const [session, setSession] = useState<Session | null>(null);
  const [plan, setPlan] = useState<Plan>('free');
  const [pro, setPro] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshPlan = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setPlan('free');
      setPro(false);
      return;
    }
    const [profile, proStatus] = await Promise.all([
      getProfile(userId),
      isPro(userId),
    ]);
    setPlan(profile?.plan ?? 'free');
    setPro(proStatus);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await refreshPlan(data.session?.user.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      refreshPlan(s?.user.id);
    });
    return () => sub.subscription.unsubscribe();
  }, [refreshPlan]);

  const userId = session?.user.id ?? null;

  return (
    <div className="flex h-[520px] w-[380px] flex-col bg-kalshi-bg text-white">
      <header className="flex items-center justify-between border-b border-kalshi-border px-4 py-3">
        <span className="text-sm font-bold text-kalshi-yes">KalshiEdge</span>
        <span className="rounded-full bg-kalshi-panel px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
          {pro ? 'Pro' : 'Free'}
        </span>
      </header>

      <nav className="flex border-b border-kalshi-border text-xs">
        <TabButton active={tab === 'watchlist'} onClick={() => setTab('watchlist')} icon={<Star size={14} />} label="Watchlist" />
        <TabButton active={tab === 'alerts'} onClick={() => setTab('alerts')} icon={<Bell size={14} />} label="Alerts" />
        <TabButton active={tab === 'account'} onClick={() => setTab('account')} icon={<UserIcon size={14} />} label="Account" />
      </nav>

      <main className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-full items-center justify-center text-slate-400">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : (
          <>
            {tab === 'watchlist' && <WatchlistTab userId={userId} pro={pro} />}
            {tab === 'alerts' && <AlertsTab userId={userId} pro={pro} onUpgrade={() => openCheckout(session?.user.email)} />}
            {tab === 'account' && (
              <AccountTab
                session={session}
                plan={plan}
                pro={pro}
                onUpgrade={() => openCheckout(session?.user.email)}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 transition ${
        active ? 'border-b-2 border-kalshi-yes text-white' : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ---- Account tab ----

function AccountTab({
  session,
  plan,
  pro,
  onUpgrade,
}: {
  session: Session | null;
  plan: Plan;
  pro: boolean;
  onUpgrade: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message);
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) setError(error.message);
        else setNotice('Check your email to confirm your account.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <div className="p-4">
        <h2 className="mb-3 text-sm font-semibold">{mode === 'signin' ? 'Sign in' : 'Create account'}</h2>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md bg-kalshi-panel px-3 py-2 text-sm outline-none ring-1 ring-kalshi-border focus:ring-kalshi-yes"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md bg-kalshi-panel px-3 py-2 text-sm outline-none ring-1 ring-kalshi-border focus:ring-kalshi-yes"
          />
          {error && <p className="text-xs text-kalshi-no">{error}</p>}
          {notice && <p className="text-xs text-kalshi-yes">{notice}</p>}
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-kalshi-yes py-2 text-sm font-medium text-slate-900 hover:opacity-90"
          >
            {busy && <Loader2 className="animate-spin" size={14} />}
            {mode === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
        </form>
        <button
          onClick={() => {
            setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
            setError(null);
            setNotice(null);
          }}
          className="mt-3 w-full text-center text-xs text-slate-400 hover:text-slate-200"
        >
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="text-[10px] uppercase text-slate-500">Email</div>
        <div className="text-sm">{session.user.email}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-slate-500">Plan</div>
        <div className="text-sm font-semibold">{plan === 'pro' ? 'Pro' : 'Free'}</div>
      </div>

      {!pro && (
        <button
          onClick={onUpgrade}
          className="w-full rounded-md bg-kalshi-yes py-2 text-sm font-semibold text-slate-900 hover:opacity-90"
        >
          Upgrade to Pro — $7/month
        </button>
      )}

      <button
        onClick={() => supabase.auth.signOut()}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-kalshi-panel py-2 text-sm text-slate-300 ring-1 ring-kalshi-border hover:bg-kalshi-border"
      >
        <LogOut size={14} /> Sign out
      </button>
    </div>
  );
}
