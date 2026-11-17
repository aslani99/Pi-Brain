import { bearerToken, handleOptions, json } from "../_shared/http.ts";
import { verifyPiAccessToken } from "../_shared/pi.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { normalizeSupportedLocale } from "../_shared/locale.ts";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Could not start quiz.";
}

Deno.serve(async (req) => {
  const early = handleOptions(req);
  if (early) return early;
  try {
    const token = bearerToken(req);
    if (!token) return json(req, { error: "Sign in with Pi before starting a server quiz." }, 401);
    const identity = await verifyPiAccessToken(token);
    const body = await req.json().catch(() => ({}));
    const locale = normalizeSupportedLocale(body.locale ?? "en");
    if (!locale) return json(req, { error: "Choose a supported quiz language.", code: "INVALID_LOCALE" }, 400);
    const pathKey = typeof body.path_key === "string" && body.path_key.length <= 64
      ? body.path_key.trim()
      : "__random__";
    if (!pathKey) return json(req, { error: "Choose a valid quiz category or the random path." }, 400);

    const admin = getAdminClient();
    const { data: profile, error: profileError } = await admin.from("profiles")
      .select("id").eq("pi_uid", identity.uid).single();
    if (profileError || !profile) return json(req, { error: "Pi profile was not found. Sign in again." }, 401);

    const { data: allocation, error: allocationError } = await admin.rpc("allocate_unseen_quiz", {
      p_profile_id: profile.id,
      p_locale: locale,
      p_path_key: pathKey,
    });
    if (allocationError) {
      const message = allocationError.message || "Question allocation failed.";
      const knownErrors: Record<string, { error: string; status: number }> = {
        BANK_EMPTY: {
          error: "No approved questions exist in the selected language and quiz path.",
          status: 404,
        },
        BANK_EXHAUSTED: {
          error: "All approved questions in the selected language and quiz path have already been answered.",
          status: 409,
        },
        BANK_TEMPORARILY_UNAVAILABLE: {
          error: "Questions are temporarily reserved. Please try again shortly.",
          status: 409,
        },
        LOCALE_CATEGORY_UNAVAILABLE: {
          error: "This category has no approved questions in the selected language.",
          status: 404,
        },
        INSUFFICIENT_QUESTION_BANK: {
          error: "There are not enough unseen approved questions for this stage and difficulty. Your stage has not changed.",
          status: 409,
        },
      };
      for (const [code, result] of Object.entries(knownErrors)) {
        if (message.includes(code)) {
          return json(req, { error: result.error, code }, result.status);
        }
      }
      if (message.includes("Unknown or unpublished quiz category")) {
        return json(req, {
          error: "This category currently has no approved questions.",
          code: "CATEGORY_UNAVAILABLE",
        }, 404);
      }
      throw allocationError;
    }

    const sessionId = allocation?.session_id;
    if (typeof sessionId !== "string") throw new Error("Question allocation returned an invalid session.");

    // Delivery, not allocation, writes the permanent history row. Only the
    // first question is delivered here; later questions are fetched on demand.
    const { data: delivery, error: deliveryError } = await admin.rpc("deliver_quiz_question", {
      p_profile_id: profile.id,
      p_session_id: sessionId,
    });
    if (deliveryError) throw deliveryError;
    const firstQuestion = delivery?.question;
    if (!firstQuestion || typeof firstQuestion.id !== "string" || !Array.isArray(firstQuestion.options)) {
      throw new Error("The first quiz question could not be delivered.");
    }

    return json(req, {
      session_id: sessionId,
      path_key: allocation.path_key,
      stage: allocation.stage,
      question_count: allocation.question_count,
      difficulty: allocation.difficulty,
      bank_status: "BANK_AVAILABLE",
      locale,
      questions: [firstQuestion],
    });
  } catch (error) {
    const message = messageOf(error);
    if (message.includes("invalid or expired")) {
      return json(req, { error: "Your Pi session is invalid or expired. Please sign in again.", code: "PI_SESSION_INVALID" }, 401);
    }
    return json(req, { error: "Could not start the quiz. Please try again.", code: "QUIZ_START_FAILED" }, 500);
  }
});
