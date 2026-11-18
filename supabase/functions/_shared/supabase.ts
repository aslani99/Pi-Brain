import { createClient } from "npm:@supabase/supabase-js@2.112.4";

function getSecretKey(): string {
  const direct = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY");
  if (direct) return direct;
  const allKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (allKeys) {
    try {
      const parsed = JSON.parse(allKeys);
      if (typeof parsed?.default === "string") return parsed.default;
    } catch { /* handled below */ }
  }
  throw new Error("Supabase server secret is not configured. Add SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY to Edge Function secrets.");
}

export function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) throw new Error("SUPABASE_URL is missing from Edge Function environment.");
  return createClient(url, getSecretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "X-Client-Info": "pi-brain-edge-functions" } },
  });
}
