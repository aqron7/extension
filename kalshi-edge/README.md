# KalshiEdge

A power-user Chrome extension (Manifest V3) for [Kalshi](https://kalshi.com)
prediction-market traders. It injects a sidebar into Kalshi market pages and
ships a popup dashboard with price charts, watchlists, and price alerts.

- **Sidebar** (content script): 7-day yes-price chart, bid/ask spread, close
  countdown, open interest & volume, and a watchlist toggle.
- **Popup dashboard**: Watchlist, Alerts (Pro), and Account tabs.
- **Background**: polls active alerts every 5 minutes and fires desktop
  notifications when a market crosses your threshold.
- **Auth + data**: Supabase (email/password auth, watchlist & alerts tables
  with row-level security).
- **Payments**: Stripe Checkout via a hosted Payment Link, with a Supabase Edge
  Function webhook that flips a user's plan to `pro`.

## Tech stack

React 18 + TypeScript, Vite + [`@crxjs/vite-plugin`](https://crxjs.dev),
Tailwind CSS, Recharts, `@supabase/supabase-js`, Stripe Payment Links.

---

## 1. Prerequisites

- Node.js 18+ and npm
- A [Supabase](https://supabase.com) project
- A [Stripe](https://stripe.com) account

## 2. Install & configure

```bash
cd kalshi-edge
npm install
cp .env.example .env   # then fill in the values below
```

`.env` variables:

| Variable | Where to get it |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` public key |
| `VITE_STRIPE_PAYMENT_LINK` | Stripe → Payment Links → your $7/mo link URL |
| `VITE_STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (used by the Edge Function) |

> Vite inlines `VITE_*` vars at build time, so re-run `npm run build` after
> changing `.env`.

## 3. Supabase setup

1. Create a project at https://supabase.com.
2. Open the **SQL editor** and run [`supabase/schema.sql`](supabase/schema.sql).
   This creates the `profiles`, `watchlist`, and `alerts` tables, a trigger that
   auto-creates a profile on signup, and row-level-security policies so each
   user can only touch their own rows.
3. Under **Authentication → Providers**, ensure **Email** is enabled. For local
   testing you can disable "Confirm email" so sign-ups are usable immediately.

### Deploy the Stripe webhook (Edge Function)

```bash
npm i -g supabase
supabase login
supabase link --project-ref <your-project-ref>

supabase secrets set \
  STRIPE_SECRET_KEY=sk_live_or_test_... \
  STRIPE_WEBHOOK_SECRET=whsec_...

supabase functions deploy stripe-webhook --no-verify-jwt
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically into
the Edge runtime. The function URL will be:

```
https://<project-ref>.functions.supabase.co/stripe-webhook
```

## 4. Stripe setup

1. Create a **recurring $7/month** product/price in the Stripe dashboard.
2. Create a **Payment Link** for that price. Put its URL in
   `VITE_STRIPE_PAYMENT_LINK`.
   - The extension appends `prefilled_email` and `client_reference_id` (the
     user's email) to the link so the webhook can match the payment back to a
     Supabase profile.
3. Create a **Webhook endpoint** pointing at the deployed Edge Function URL and
   subscribe to:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the webhook **signing secret** (`whsec_...`) into the `STRIPE_WEBHOOK_SECRET`
   Supabase secret (step 3) — and into `.env` for reference.

## 5. Build & load in Chrome (dev mode)

```bash
npm run build      # outputs to dist/
```

1. Open `chrome://extensions`.
2. Toggle **Developer mode** (top-right).
3. Click **Load unpacked** and select the `dist/` folder.
4. Visit a Kalshi market page (`https://kalshi.com/markets/...`) — the sidebar
   toggle appears on the right edge. Click the toolbar icon for the popup.

### Hot reload during development

```bash
npm run dev
```

CRXJS writes a live-reloading build to `dist/`. Load `dist/` as unpacked once;
changes rebuild and reload automatically.

## 6. Free vs. Pro

| Feature | Free | Pro ($7/mo) |
| --- | --- | --- |
| Sidebar charts & market info | ✅ | ✅ |
| Watchlist | up to 5 markets | unlimited |
| Price alerts + notifications | — | ✅ |

Logged-out users get a watchlist stored in `chrome.storage.local`; signing in
syncs it to Supabase.

## 7. Submitting to the Chrome Web Store

1. `npm run build`, then zip the **contents** of `dist/` (not the folder
   itself):
   ```bash
   cd dist && zip -r ../kalshi-edge.zip . && cd ..
   ```
2. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   (one-time $5 registration fee).
3. **Add new item**, upload `kalshi-edge.zip`.
4. Fill in store listing (description, screenshots, at least one 128×128 icon),
   privacy practices, and justify the requested permissions
   (`storage`, `alarms`, `notifications`, `identity`) and host permissions
   (`kalshi.com`, `api.kalshi.com`).
5. Submit for review.

> Placeholder icons in `public/icons/` are generated at build time by
> `scripts/generate-icons.mjs` (run automatically via `npm run dev`/`build`),
> so they aren't committed. Replace the script output with real branded
> artwork before publishing.

## Project structure

```
kalshi-edge/
├── src/
│   ├── background/service-worker.ts   # alarm-based alert polling + notifications
│   ├── content/                       # injected sidebar (shadow-DOM isolated)
│   ├── popup/                         # popup dashboard + tabs
│   ├── lib/                           # kalshi / supabase / stripe / storage clients
│   └── types.ts
├── public/manifest.json
├── supabase/schema.sql
└── supabase/functions/stripe-webhook/index.ts
```

## Notes

- Icon paths in `manifest.json` are `icons/icon*.png` (not `public/icons/...`):
  Vite copies everything under `public/` to the build root, so the deployed
  paths drop the `public/` prefix.
- Kalshi market-data endpoints are public and read-only — no API key needed.
