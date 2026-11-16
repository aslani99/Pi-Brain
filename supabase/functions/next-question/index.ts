import { bearerToken, handleOptions, json } from "../_shared/http.ts";
import { verifyPiAccessToken } from "../_shared/pi.ts";
import { getAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const early = handleOptions(req);
  if (early) return early;
  try {
    const token = bearerToken(req);
    if (!token) return json(req, { error: "Sign in with Pi before continuing this quiz." }, 401);
    const identity = await verifyPiAccessToken(token);
    const body = await req.json().catch(() => ({}));
    const sessionId = typeof body.session_id === "string" ? body.session_id : "";
    if (!sessionId) return json(req, { error: "A valid quiz session is required." }, 400);

    const admin = getAdminClient();
    const { data: profile, error: profileError } = await admin.from("profiles")
      .select("id").eq("pi_uid", identity.uid).single();
    if (profileError || !profile) return json(req, { error: "Pi profile was not found. Sign in again." }, 401);

    const { data, error } = await admin.rpc("deliver_quiz_question", {
      p_profile_id: profile.id,
      p_session_id: sessionId,
    });
    if (error) throw error;
    const question = data?.question;
    if (!question || typeof question.id !== "string" || !Array.isArray(question.options)) {
      throw new Error("The next question could not be delivered.");
    }
    return json(req, {
      question,
      question_index: data.question_index,
      stage: data.stage,
      question_count: data.question_count,
      difficulty: data.difficulty,
      path_key: data.path_key,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load the next question.";
    const status = message.includes("invalid or expired") ? 401 : 409;
    return json(req, { error: message }, status);
  }
});
