import { getMarket } from '../lib/kalshi';
import {
  getCurrentUserId,
  isPro,
  getActiveAlertsRemote,
  setAlertTriggered,
} from '../lib/supabase';
import { getDisabledAlertIds } from '../lib/storage';

const ALARM = 'pollAlerts';

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM, { periodInMinutes: 5 });
});

// Re-create the alarm when the worker spins back up.
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM, { periodInMinutes: 5 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM) return;
  await pollAlerts();
});

function conditionMet(condition: string, price: number, threshold: number): boolean {
  return condition === 'above' ? price >= threshold : price <= threshold;
}

async function pollAlerts() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return;
    if (!(await isPro(userId))) return;

    const [alerts, disabled] = await Promise.all([
      getActiveAlertsRemote(userId),
      getDisabledAlertIds(),
    ]);

    for (const alert of alerts) {
      if (!alert.id || disabled.includes(alert.id)) continue;

      const market = await getMarket(alert.ticker);
      if (!market) continue;

      const price = market.yes_bid;
      if (!conditionMet(alert.condition, price, alert.threshold)) continue;

      chrome.notifications.create(`alert-${alert.id}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon48.png'),
        title: 'KalshiEdge Alert',
        message: `${market.title} is now at ${price}¢`,
      });

      await setAlertTriggered(alert.id, true);
    }
  } catch (err) {
    console.error('[KalshiEdge] pollAlerts failed', err);
  }
}

// Clicking a notification opens Kalshi.
chrome.notifications.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'https://kalshi.com' });
});
