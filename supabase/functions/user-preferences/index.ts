import { bearerToken, handleOptions, json } from "../_shared/http.ts";
import { verifyPiAccessToken } from "../_shared/pi.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { normalizeSupportedLocale } from "../_shared/locale.ts";

const DEFAULTS = { theme: "cosmic", soundEnabled: true, reducedMotion: false };

Deno.serve(async (req) => {
  const early = handleOptions(req);
  if (early) return early;
  try {
    const token = bearerToken(req);
    if (!token) return json(req, { error: "Missing Pi access token." }, 401);
    const identity = await verifyPiAccessToken(token);
    const admin = getAdminClient();

    const { data: profile, error: profileError } = await admin
      .from("profiles").select("id,locale").eq("pi_uid", identity.uid).maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return json(req, { error: "Pi profile was not found. Sign in again." }, 404);

    const { data, error } = await admin.from("user_preferences")
      .select("preferences,version,updated_at").eq("profile_id", profile.id).maybeSingle();
    if (error) throw error;

    const language = normalizeSupportedLocale(data?.preferences?.language ?? profile.locale) ?? "en";
    const quizLanguage = normalizeSupportedLocale(data?.preferences?.quizLanguage) ?? language;
    const preferences = {
      ...DEFAULTS,
      ...(data?.preferences ?? {}),
      language,
      quizLanguage,
    };
    return json(req, {
      preferences,
      version: data?.version ?? 0,
      updated_at: data?.updated_at ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load user preferences.";
    const status = message.includes("invalid or expired") ? 401 : 500;
    return json(req, { error: message }, status);
  }
});
