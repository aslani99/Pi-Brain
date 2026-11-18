import { bearerToken, handleOptions, json } from "../_shared/http.ts";
import { verifyPiAccessToken } from "../_shared/pi.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { normalizeSupportedLocale } from "../_shared/locale.ts";

const THEMES = new Set(["cosmic", "light", "ocean", "aurora", "sunset", "royal", "rose"]);

Deno.serve(async (req) => {
  const early = handleOptions(req);
  if (early) return early;
  try {
    const token = bearerToken(req);
    if (!token) return json(req, { error: "Missing Pi access token." }, 401);
    const identity = await verifyPiAccessToken(token);
    const body = await req.json().catch(() => ({}));
    const preferences = body?.preferences;
    const expectedVersion = body?.expected_version;

    if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) {
      return json(req, { error: "Invalid preferences payload." }, 400);
    }
    const language = normalizeSupportedLocale(preferences.language);
    const quizLanguage = normalizeSupportedLocale(preferences.quizLanguage ?? preferences.language);
    if (!language || !quizLanguage || !THEMES.has(preferences.theme)
      || typeof preferences.soundEnabled !== "boolean"
      || typeof preferences.reducedMotion !== "boolean") {
      return json(req, { error: "One or more preference values are invalid." }, 400);
    }
    if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
      return json(req, { error: "A valid preferences version is required." }, 400);
    }

    const normalizedPreferences = {
      ...preferences,
      language,
      quizLanguage,
    };

    const admin = getAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles").select("id").eq("pi_uid", identity.uid).maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return json(req, { error: "Pi profile was not found. Sign in again." }, 404);

    const { data, error } = await admin.rpc("save_user_preferences", {
      p_profile_id: profile.id,
      p_preferences: normalizedPreferences,
      p_expected_version: expectedVersion,
    });
    if (error) {
      if (error.message.includes("PREFERENCES_VERSION_CONFLICT")) {
        return json(req, { error: "Preferences changed on another device. Reload the latest settings before saving again." }, 409);
      }
      throw error;
    }
    return json(req, data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save user preferences.";
    const status = message.includes("invalid or expired") ? 401 : 500;
    return json(req, { error: message }, status);
  }
});
