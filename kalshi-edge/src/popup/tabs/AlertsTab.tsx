import { useCallback, useEffect, useState } from 'react';
import { Lock, Plus, Trash2, Loader2, Bell } from 'lucide-react';
import {
  getAlertsRemote,
  createAlertRemote,
  deleteAlertRemote,
} from '../../lib/supabase';
import { getDisabledAlertIds, setAlertEnabled } from '../../lib/storage';
import type { Alert, AlertCondition } from '../../types';

export function AlertsTab({
  userId,
  pro,
  onUpgrade,
}: {
  userId: string | null;
  pro: boolean;
  onUpgrade: () => void;
}) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [disabled, setDisabled] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [ticker, setTicker] = useState('');
  const [condition, setCondition] = useState<AlertCondition>('above');
  const [threshold, setThreshold] = useState(50);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!userId || !pro) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [list, off] = await Promise.all([
      getAlertsRemote(userId).catch(() => []),
      getDisabledAlertIds(),
    ]);
    setAlerts(list);
    setDisabled(off);
    setLoading(false);
  }, [userId, pro]);

  useEffect(() => {
    load();
  }, [load]);

  if (!pro) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <Lock className="text-slate-500" size={28} />
        <p className="text-sm text-slate-300">Price alerts are a Pro feature.</p>
        <p className="text-xs text-slate-500">
          Get notified the moment a market crosses your target price.
        </p>
        <button
          onClick={onUpgrade}
          className="mt-2 rounded-md bg-kalshi-yes px-4 py-2 text-sm font-semibold text-slate-900 hover:opacity-90"
        >
          Upgrade to Pro — $7/month
        </button>
      </div>
    );
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !ticker.trim()) return;
    setSaving(true);
    try {
      await createAlertRemote(userId, {
        ticker: ticker.trim().toUpperCase(),
        title: null,
        condition,
        threshold,
      });
      setTicker('');
      setThreshold(50);
      setCondition('above');
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await deleteAlertRemote(id);
    setAlerts((a) => a.filter((x) => x.id !== id));
  }

  async function toggle(id: string, enabled: boolean) {
    await setAlertEnabled(id, enabled);
    setDisabled((d) => (enabled ? d.filter((x) => x !== id) : [...d, id]));
  }

  return (
    <div className="p-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Active alerts</h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1 rounded-md bg-kalshi-yes px-2 py-1 text-xs font-medium text-slate-900 hover:opacity-90"
        >
          <Plus size={14} /> New
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="mb-3 space-y-2 rounded-md bg-kalshi-panel p-3 ring-1 ring-kalshi-border">
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder="Market ticker (e.g. KXNBA-…)"
            required
            className="w-full rounded bg-kalshi-bg px-2 py-1.5 text-xs uppercase outline-none ring-1 ring-kalshi-border focus:ring-kalshi-yes"
          />
          <div className="flex gap-2">
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as AlertCondition)}
              className="flex-1 rounded bg-kalshi-bg px-2 py-1.5 text-xs outline-none ring-1 ring-kalshi-border focus:ring-kalshi-yes"
            >
              <option value="above">Above</option>
              <option value="below">Below</option>
            </select>
            <input
              type="number"
              min={0}
              max={99}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-20 rounded bg-kalshi-bg px-2 py-1.5 text-xs outline-none ring-1 ring-kalshi-border focus:ring-kalshi-yes"
            />
            <span className="self-center text-xs text-slate-400">¢</span>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded bg-kalshi-yes py-1.5 text-xs font-medium text-slate-900 hover:opacity-90"
          >
            {saving && <Loader2 className="animate-spin" size={12} />} Create alert
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-8 text-slate-400">
          <Loader2 className="animate-spin" size={18} />
        </div>
      ) : alerts.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">
          <Bell className="mx-auto mb-2 text-slate-600" size={24} />
          No alerts yet.
        </div>
      ) : (
        <ul className="space-y-1">
          {alerts.map((a) => {
            const enabled = !disabled.includes(a.id!);
            return (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-md bg-kalshi-panel px-3 py-2 ring-1 ring-kalshi-border"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-xs">{a.ticker}</div>
                  <div className="text-[10px] text-slate-400">
                    {a.condition} {a.threshold}¢ {a.triggered && '· triggered'}
                  </div>
                </div>
                <label className="flex cursor-pointer items-center" title={enabled ? 'Enabled' : 'Disabled'}>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => toggle(a.id!, e.target.checked)}
                    className="peer sr-only"
                  />
                  <span className="relative h-4 w-7 rounded-full bg-kalshi-border transition peer-checked:bg-kalshi-yes after:absolute after:left-0.5 after:top-0.5 after:h-3 after:w-3 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-3" />
                </label>
                <button onClick={() => remove(a.id!)} className="text-slate-600 hover:text-kalshi-no" title="Delete">
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
