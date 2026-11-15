import { bearerToken, handleOptions, json } from "../_shared/http.ts";
import { verifyPiAccessToken } from "../_shared/pi.ts";
import { getAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const early = handleOptions(req);
  if (early) return early;
  try {
    const token = bearerToken(req);
    if (!token) return json(req, { error: "Missing Pi access token." }, 401);
    const identity = await verifyPiAccessToken(token);
    const body = await req.json().catch(() => ({}));
    const locale = typeof body.locale === "string" && /^[a-z]{2}(-[A-Z]{2})?$/.test(body.locale) ? body.locale : "en";
    const admin = getAdminClient();
    const profileFields = "id,pi_uid,username,display_name,locale,total_xp,total_answered,total_correct,day_streak,last_active_date";
    const { data: existing, error: lookupError } = await admin.from("profiles")
      .select("id").eq("pi_uid", identity.uid).maybeSingle();
    if (lookupError) throw lookupError;

    let data;
    if (existing) {
      // Update identity metadata only. Never reset a Pioneer’s accumulated XP or streak on login.
      const result = await admin.from("profiles").update({
        username: identity.username,
        display_name: identity.username,
        locale,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id).select(profileFields).single();
      if (result.error) throw result.error;
      data = result.data;
    } else {
      const result = await admin.from("profiles").insert({
        pi_uid: identity.uid,
        username: identity.username,
        display_name: identity.username,
        locale,
      }).select(profileFields).single();
      if (result.error) {
        // Handle two first-login requests racing to create the same Pi UID.
        if (result.error.code !== "23505") throw result.error;
        const retry = await admin.from("profiles").update({
          username: identity.username,
          display_name: identity.username,
          locale,
          updated_at: new Date().toISOString(),
        }).eq("pi_uid", identity.uid).select(profileFields).single();
        if (retry.error) throw retry.error;
        data = retry.data;
      } else {
        data = result.data;
      }
    }
    return json(req, { ok: true, profile: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication failed.";
    const status = message.includes("invalid or expired") ? 401 : 500;
    return json(req, { error: message }, status);
  }
});
