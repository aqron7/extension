// Supabase Edge Function: Stripe webhook handler.
//
// Deploy with:
//   supabase functions deploy stripe-webhook --no-verify-jwt
//
// Required secrets (set via `supabase secrets set`):
//   STRIPE_SECRET_KEY          — Stripe API secret key (sk_...)
//   STRIPE_WEBHOOK_SECRET      — signing secret for this endpoint (whsec_...)
//   SUPABASE_URL               — provided automatically in the Edge runtime
//   SUPABASE_SERVICE_ROLE_KEY  — service role key (bypasses RLS to update plan)
//
// Point a Stripe webhook at this function's URL and subscribe to:
//   checkout.session.completed
//   customer.subscription.deleted
//   customer.subscription.updated

import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const cryptoProvider = Stripe.createSubtleCryptoProvider();

// Resolve a profile id from the email Stripe carries for the customer.
async function profileIdForEmail(email: string | null): Promise<string | null> {
  if (!email) return null;
  const { data } = await supabase.from('profiles').select('id').eq('email', email).single();
  return data?.id ?? null;
}

async function setPlan(
  email: string | null,
  customerId: string | null,
  plan: 'free' | 'pro',
  expiresAt: string | null,
) {
  const id = await profileIdForEmail(email);
  if (!id) {
    console.error('No profile found for email', email);
    return;
  }
  const { error } = await supabase
    .from('profiles')
    .update({ plan, plan_expires_at: expiresAt, stripe_customer_id: customerId })
    .eq('id', id);
  if (error) console.error('Failed to update profile', error);
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      webhookSecret,
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    console.error('Signature verification failed', err);
    return new Response('Invalid signature', { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      // We pass the user email as client_reference_id (and prefilled_email).
      const email = session.client_reference_id ?? session.customer_email ?? null;
      const customerId = (session.customer as string) ?? null;
      // Default a monthly subscription to ~31 days out; subscription.updated
      // events will keep this in sync going forward.
      const expires = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString();
      await setPlan(email, customerId, 'pro', expires);
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const customer = await stripe.customers.retrieve(sub.customer as string);
      const email = (customer as Stripe.Customer).email ?? null;
      const active = sub.status === 'active' || sub.status === 'trialing';
      const expires = new Date(sub.current_period_end * 1000).toISOString();
      await setPlan(email, sub.customer as string, active ? 'pro' : 'free', active ? expires : null);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const customer = await stripe.customers.retrieve(sub.customer as string);
      const email = (customer as Stripe.Customer).email ?? null;
      await setPlan(email, sub.customer as string, 'free', null);
      break;
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
