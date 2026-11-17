import { bearerToken, handleOptions, json } from "../_shared/http.ts";
import { verifyPiAccessToken } from "../_shared/pi.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { normalizeSupportedLocale } from "../_shared/locale.ts";

Deno.serve(async (req) => {
  const early = handleOptions(req);
  if (early) return early;
  try {
    const token = bearerToken(req);
    if (!token) return json(req, { error: "Sign in with Pi to load your quiz paths." }, 401);
    const identity = await verifyPiAccessToken(token);
    const body = await req.json().catch(() => ({}));
    const locale = normalizeSupportedLocale(body.locale ?? "en");
    if (!locale) return json(req, { error: "Choose a supported quiz language.", code: "INVALID_LOCALE" }, 400);

    const admin = getAdminClient();
    const { data: profile, error: profileError } = await admin.from("profiles")
      .select("id").eq("pi_uid", identity.uid).single();
    if (profileError || !profile) return json(req, { error: "Pi profile was not found. Sign in again." }, 401);

    const { data, error } = await admin.rpc("get_quiz_catalog", {
      p_profile_id: profile.id,
      p_locale: locale,
    });
    if (error) throw error;
    return json(req, {
      categories: Array.isArray(data?.categories) ? data.categories : [],
      progress: data?.progress && typeof data.progress === "object" ? data.progress : {},
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("invalid or expired")) {
      return json(req, { error: "Your Pi session is invalid or expired. Please sign in again.", code: "PI_SESSION_INVALID" }, 401);
    }
    return json(req, { error: "Could not load quiz categories. Please try again.", code: "CATALOG_LOAD_FAILED" }, 500);
  }
});
