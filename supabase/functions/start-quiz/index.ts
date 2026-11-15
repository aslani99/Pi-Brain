import { bearerToken, handleOptions, json } from "../_shared/http.ts";
import { verifyPiAccessToken } from "../_shared/pi.ts";
import { getAdminClient } from "../_shared/supabase.ts";

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

Deno.serve(async (req) => {
  const early = handleOptions(req);
  if (early) return early;
  try {
    const token = bearerToken(req);
    if (!token) return json(req, { error: "Sign in with Pi before starting a server quiz." }, 401);
    const identity = await verifyPiAccessToken(token);
    const body = await req.json();
    const category = typeof body.category === "string" ? body.category.slice(0, 64) : "All";
    const locale = typeof body.locale === "string" && /^[a-z]{2}(-[A-Z]{2})?$/.test(body.locale) ? body.locale : "en";
    const count = Math.min(10, Math.max(3, Number.isInteger(body.count) ? body.count : 5));
    const admin = getAdminClient();

    const { data: profile, error: profileError } = await admin.from("profiles")
      .select("id").eq("pi_uid", identity.uid).single();
    if (profileError || !profile) return json(req, { error: "Pi profile was not found. Sign in again." }, 401);

    const selectFields = "id,category,difficulty,locale,prompt,options";
    let query = admin.from("questions").select(selectFields).eq("review_status", "approved").eq("locale", locale);
    if (category && category !== "All") query = query.eq("category", category);
    let { data: available, error } = await query.limit(200);
    if (error) throw error;

    // Fall back to approved English questions only when this locale has no approved content.
    if (!available?.length && locale !== "en") {
      let fallback = admin.from("questions").select(selectFields).eq("review_status", "approved").eq("locale", "en");
      if (category && category !== "All") fallback = fallback.eq("category", category);
      const result = await fallback.limit(200);
      available = result.data;
      error = result.error;
      if (error) throw error;
    }
    if (!available?.length) return json(req, { error: "No reviewed questions are published for this topic and language yet." }, 404);

    const selected = shuffle(available).slice(0, Math.min(count, available.length));
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { data: session, error: sessionError } = await admin.from("quiz_sessions").insert({
      profile_id: profile.id,
      question_ids: selected.map((item) => item.id),
      current_index: 0,
      score: 0,
      expires_at: expiresAt,
    }).select("id").single();
    if (sessionError) throw sessionError;

    // Deliberately omit answer_index and explanation. They are returned only after an answer is submitted.
    return json(req, {
      session_id: session.id,
      questions: selected.map((item) => ({
        id: item.id,
        category: item.category,
        difficulty: item.difficulty,
        prompt: item.prompt,
        options: item.options,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start quiz.";
    const status = message.includes("invalid or expired") ? 401 : 500;
    return json(req, { error: message }, status);
  }
});
