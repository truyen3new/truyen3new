// @ts-nocheck
// This edge function validates input and delegates atomic story view increments to RPC.
import { createClient } from "npm:@supabase/supabase-js@2";
import { ViewSchema } from "../lib/validators/stories.validator.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Missing Supabase environment configuration" }, 500);
  }

  const body = await req.json().catch(() => null);
  const parsed = ViewSchema.safeParse({ storyId: body?.storyId ?? body?.story_id });
  if (!parsed.success) {
    return jsonResponse({ error: 'Invalid input', details: parsed.error.errors }, 400);
  }
  const storyId = parsed.data.storyId;

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await supabase.rpc("increment_story_views", {
    story_id_param: storyId.trim(),
  });

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  return jsonResponse({ ok: true }, 200);
});
