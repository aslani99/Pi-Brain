import { bearerToken, handleOptions, json } from "../_shared/http.ts";
import { verifyPiAccessToken } from "../_shared/pi.ts";
import { getAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const early = handleOptions(req);
  if (early) return early;
  try {
    const token = bearerToken(req);
    if (!token) return json(req, { error: "Sign in with Pi before submitting an answer." }, 401);
    const identity = await verifyPiAccessToken(token);
    const body = await req.json();
    const sessionId = typeof body.session_id === "string" ? body.session_id : "";
    const questionId = typeof body.question_id === "string" ? body.question_id : "";
    const selectedIndex = body.selected_index;
    if (!sessionId || !questionId || !Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 3) {
      return json(req, { error: "Invalid quiz answer payload." }, 400);
    }

    const admin = getAdminClient();
    const { data: profile, error: profileError } = await admin.from("profiles")
      .select("id").eq("pi_uid", identity.uid).single();
    if (profileError || !profile) return json(req, { error: "Pi profile was not found. Sign in again." }, 401);

    const { data, error } = await admin.rpc("record_quiz_answer", {
      p_profile_id: profile.id,
      p_session_id: sessionId,
      p_question_id: questionId,
      p_selected_index: selectedIndex,
    });
    if (error) throw error;
    return json(req, data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not submit answer.";
    const status = message.includes("invalid or expired") ? 401 : 400;
    return json(req, { error: message }, status);
  }
});
