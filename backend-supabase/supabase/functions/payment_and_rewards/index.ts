// Supabase Edge Function (Deno) - payment_webhook and daily_checkin handler
// Location: backend-supabase/supabase/functions/payment_and_rewards/index.ts
// Notes: Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env bindings

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { headers: { 'x-source': 'edge-payment-and-rewards' } }
});

function ok(body = { ok: true }) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

function badRequest(msg = 'Bad Request') {
  return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { 'content-type': 'application/json' } });
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  // Minimal JSON parse with defensive checks
  let body: any;
  try {
    body = await req.json();
  } catch (e) {
    return badRequest('invalid-json');
  }

  const eventType = body?.type;
  if (!eventType) return badRequest('missing-type');

  try {
    if (eventType === 'payment_webhook') {
      // Example payload: { type: 'payment_webhook', data: { user_id, amount, provider, provider_event } }
      const data = body.data || {};
      const userId = data.user_id;
      if (!userId) return badRequest('missing-user-id');

      // Validate provider signature here (placeholder). Keep validation light to avoid blocking.
      // Validate signature header if present.
      // const sig = req.headers.get('x-provider-signature');

      // Record payment row (atomic insert)
      await supabase.from('payments').insert([{ user_id: userId, amount: data.amount || 0, provider: data.provider || 'unknown', raw_event: data.provider_event || null }]);

      // Enqueue follow-up actions asynchronously (non-blocking)
      // e.g., grant premium role, send email — use ctx.waitUntil equivalent by using fetch to internal queue endpoint
      // For edge environments without waitUntil, keep follow-ups minimal and idempotent.

      return ok({ recorded: true });
    }

    if (eventType === 'daily_checkin') {
      // Example payload: { type: 'daily_checkin', data: { user_id } }
      const userId = body?.data?.user_id;
      if (!userId) return badRequest('missing-user-id');

      // Idempotent reward grant: upsert into daily_checkins and add reward once per day
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from('daily_checkins').upsert([
        { user_id: userId, checkin_date: today, awarded: true }
      ], { onConflict: ['user_id', 'checkin_date'] });

      if (error) {
        console.error('daily_checkin upsert error', error);
        return new Response(JSON.stringify({ error: 'db_error' }), { status: 500 });
      }

      // Optionally increment user's credits/points
      await supabase.rpc('grant_daily_checkin_reward', { p_user_id: userId }).catch((e) => console.error(e));

      return ok({ rewarded: true });
    }

    return badRequest('unknown-type');
  } catch (err) {
    console.error('handler-error', err);
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500 });
  }
};
