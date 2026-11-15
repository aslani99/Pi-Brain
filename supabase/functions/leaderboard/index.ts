import { bearerToken, handleOptions, json } from "../_shared/http.ts";
import { verifyPiAccessToken } from "../_shared/pi.ts";
import { getAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const early = handleOptions(req);
  if (early) return early;
  try {
    const token = bearerToken(req);
    if (!token) return json(req, { error: "Sign in with Pi to view the live leaderboard." }, 401);
    await verifyPiAccessToken(token);
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(100, Math.max(1, Number.isInteger(body.limit) ? body.limit : 50));
    const admin = getAdminClient();
    const { data, error } = await admin.from("profiles")
      .select("username,total_xp")
      .order("total_xp", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw error;
    return json(req, { entries: (data ?? []).map((item, index) => ({ rank: index + 1, ...item })) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load leaderboard.";
    return json(req, { error: message }, message.includes("invalid or expired") ? 401 : 500);
  }
});
