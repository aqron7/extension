// Stripe Checkout via a hosted Payment Link — no backend required for the
// redirect itself. After payment, a Stripe webhook (Supabase Edge Function)
// flips profiles.plan to 'pro'.

const PAYMENT_LINK = import.meta.env.VITE_STRIPE_PAYMENT_LINK as string | undefined;

// Open the Payment Link in a new tab. We pass the user's email through as a
// prefill / client_reference_id so the webhook can match the Stripe customer
// back to a Supabase profile.
export function openCheckout(email?: string): void {
  if (!PAYMENT_LINK) {
    console.error('[KalshiEdge] VITE_STRIPE_PAYMENT_LINK is not configured.');
    return;
  }

  const url = new URL(PAYMENT_LINK);
  if (email) {
    url.searchParams.set('prefilled_email', email);
    url.searchParams.set('client_reference_id', email);
  }

  chrome.tabs.create({ url: url.toString() });
}
