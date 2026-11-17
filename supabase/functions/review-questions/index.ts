// Admin-only research and human review queue. Automation never publishes questions.
import { handleOptions, json } from "../_shared/http.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { researchWithWebSearch } from "../_shared/research.ts";

async function sameSecret(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const x = new Uint8Array(left);
  const y = new Uint8Array(right);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

async function researchQuestion(admin: ReturnType<typeof getAdminClient>, questionId: string) {
  // Defense in depth: never call a paid AI provider while automation is paused.
  if (Deno.env.get("PI_BRAIN_AI_AUTOMATION_ENABLED") !== "true") {
    throw new Error("AI question research is paused by the project owner. No AI provider request was made.");
  }
  const { data: question, error: questionError } = await admin.from("questions")
    .select("id,slug,category,difficulty,locale,prompt,options,answer_index,explanation,review_status")
    .eq("id", questionId).maybeSingle();
  if (questionError) throw questionError;
  if (!question) throw new Error(`Question not found: ${questionId}`);
  if (!["draft", "fact_checked"].includes(question.review_status)) {
    throw new Error(`Question ${question.slug} is not an unpublished draft.`);
  }

  const correctAnswer = Array.isArray(question.options) ? question.options[question.answer_index] : null;
  const prompt = `Research and fact-check this educational multiple-choice question. Search the web; do not rely on memory alone.

Category: ${question.category}
Difficulty: ${question.difficulty}
Locale: ${question.locale}
Question: ${question.prompt}
Options: ${JSON.stringify(question.options)}
Claimed correct answer: ${String(correctAnswer)}
Explanation: ${question.explanation}

Return one JSON object with these fields: verdict (supported|unsupported|uncertain), answer_supported (boolean), explanation_supported (boolean), novelty_score (integer 0-100), novelty_notes (short editorial explanation of how uncommon the underlying fact/concept is), fact_summary (short evidence-based summary), sources (array of {title,url,why_relevant}). Search for at least two independent reliable sources where possible. Only list sources actually opened or returned by web search and cite their URLs in the response so they appear as URL citations. If the exact answer or explanation is not supported, do not mark it supported. Do not infer that a question is globally unseen; novelty_score is only an estimate of how uncommon it is in typical trivia banks.`;
  const { result, citations } = await researchWithWebSearch(prompt);
  const verdict = ["supported", "unsupported", "uncertain"].includes(String(result.verdict)) ? String(result.verdict) : "uncertain";
  const noveltyScore = Number.isInteger(result.novelty_score) ? Math.max(0, Math.min(100, Number(result.novelty_score))) : 0;
  const domains = new Set<string>();
  for (const citation of citations) {
    try { domains.add(new URL(citation.url).hostname.toLowerCase().replace(/^www\./, "")); } catch { /* Ignore malformed URLs. */ }
  }
  const supported = verdict === "supported"
    && result.answer_supported === true
    && result.explanation_supported === true
    && citations.length >= 2
    && domains.size >= 2
    && noveltyScore >= 65;
  const notes = `Web research verdict: ${verdict}. Answer supported: ${result.answer_supported === true}. Explanation supported: ${result.explanation_supported === true}. Independent cited domains: ${domains.size}. Estimated rarity score: ${noveltyScore}/100. ${String(result.novelty_notes || "")}`.slice(0, 3000);
  const report = {
    verdict,
    answer_supported: result.answer_supported === true,
    explanation_supported: result.explanation_supported === true,
    novelty_score: noveltyScore,
    novelty_notes: String(result.novelty_notes || "").slice(0, 1200),
    fact_summary: String(result.fact_summary || "").slice(0, 1800),
    cited_domains: [...domains],
    citations,
    researched_at: new Date().toISOString(),
    model: Deno.env.get("OPENAI_RESEARCH_MODEL") || "gpt-6-astra",
  };
  const { data: updated, error: updateError } = await admin.from("questions")
    .update({
      source_refs: citations,
      automated_review_status: supported ? "passed" : "needs_review",
      automated_review_notes: notes,
      fact_check_status: verdict,
      fact_check_notes: notes,
      fact_check_report: report,
      novelty_score: noveltyScore,
      novelty_notes: String(result.novelty_notes || "").slice(0, 1200),
    })
    .eq("id", questionId)
    .in("review_status", ["draft", "fact_checked"])
    .select("id,slug,review_status,automated_review_status,fact_check_status,novelty_score,source_refs")
    .maybeSingle();
  if (updateError) throw updateError;
  if (!updated) throw new Error(`Question changed during research: ${question.slug}`);
  return {
    question: updated,
    source_count: citations.length,
    independent_domains: domains.size,
    passed_automated_gate: supported,
  };
}

Deno.serve(async (req) => {
  const early = handleOptions(req);
  if (early) return early;
  try {
    const configuredSecret = Deno.env.get("PI_BRAIN_ADMIN_SECRET") || "";
    const providedSecret = req.headers.get("x-pi-admin-secret") || "";
    if (!configuredSecret || !(await sameSecret(providedSecret, configuredSecret))) {
      return json(req, { error: "Admin authorization failed." }, 401);
    }

    const body = await req.json();
    const admin = getAdminClient();
    const action = typeof body.action === "string" ? body.action : "list";

    if (action === "list") {
      const limit = Math.min(100, Math.max(1, Number.isInteger(body.limit) ? body.limit : 30));
      let query = admin.from("questions")
        .select("id,slug,category,difficulty,locale,prompt,options,answer_index,explanation,source_refs,automated_review_status,automated_review_notes,fact_check_status,fact_check_notes,fact_check_report,novelty_score,novelty_notes,created_at")
        .in("review_status", ["draft", "fact_checked"])
        .order("created_at", { ascending: true })
        .limit(limit);
      if (typeof body.locale === "string") query = query.eq("locale", body.locale);
      if (typeof body.category === "string") query = query.eq("category", body.category);
      if (typeof body.difficulty === "string") query = query.eq("difficulty", body.difficulty);
      const { data, error } = await query;
      if (error) throw error;
      return json(req, { status: "ok", count: data?.length ?? 0, questions: data ?? [] });
    }

    if (action === "research" || action === "research_batch") {
      if (Deno.env.get("PI_BRAIN_AI_AUTOMATION_ENABLED") !== "true") {
        return json(req, {
          error: "AI question research is paused by the project owner.",
          code: "AI_AUTOMATION_PAUSED",
          note: "No AI provider request was made. Continue with manual source verification.",
        }, 503);
      }
    }

    if (action === "research") {
      const questionId = typeof body.question_id === "string" ? body.question_id : "";
      if (!questionId) return json(req, { error: "question_id is required for research." }, 400);
      const result = await researchQuestion(admin, questionId);
      return json(req, {
        status: "researched_not_published",
        ...result,
        note: "Web research is an automated aid, not a guarantee. Human approval is still required.",
      });
    }

    if (action === "research_batch") {
      const limit = Math.min(2, Math.max(1, Number.isInteger(body.limit) ? body.limit : 2));
      let query = admin.from("questions")
        .select("id,slug")
        .in("review_status", ["draft", "fact_checked"])
        .eq("fact_check_status", "not_checked")
        .order("created_at", { ascending: true })
        .limit(limit);
      if (typeof body.locale === "string") query = query.eq("locale", body.locale);
      if (typeof body.category === "string") query = query.eq("category", body.category);
      if (typeof body.difficulty === "string") query = query.eq("difficulty", body.difficulty);
      const { data: pending, error } = await query;
      if (error) throw error;
      const results = [];
      for (const item of pending ?? []) {
        try {
          results.push({ slug: item.slug, ...(await researchQuestion(admin, item.id)) });
        } catch (error) {
          results.push({ slug: item.slug, error: error instanceof Error ? error.message : "Research failed." });
        }
      }
      return json(req, {
        status: "batch_research_completed",
        processed: results.length,
        passed: results.filter((item: any) => item.passed_automated_gate === true).length,
        results,
        note: "Questions remain drafts. Human review and explicit approval are required before publication.",
      });
    }

    if (action !== "approve" && action !== "reject") {
      return json(req, { error: "Action must be list, research, research_batch, approve, or reject." }, 400);
    }
    const questionId = typeof body.question_id === "string" ? body.question_id : "";
    const reviewerNote = typeof body.reviewer_note === "string" ? body.reviewer_note.trim() : "";
    if (!questionId || reviewerNote.length < 20) {
      return json(req, { error: "question_id and a reviewer_note of at least 20 characters are required." }, 400);
    }

    const { data: question, error: fetchError } = await admin.from("questions")
      .select("id,review_status,source_refs,automated_review_status,fact_check_notes,fact_check_status,novelty_score")
      .eq("id", questionId).maybeSingle();
    if (fetchError) throw fetchError;
    if (!question) return json(req, { error: "Question not found." }, 404);
    if (!["draft", "fact_checked"].includes(question.review_status)) {
      return json(req, { error: `Question is not awaiting review (status: ${question.review_status}).` }, 409);
    }

    if (action === "approve") {
      if (question.automated_review_status !== "passed") {
        return json(req, { error: "Automated screening did not pass. Research the question and resolve quality issues before approval." }, 422);
      }
      if (!Array.isArray(question.source_refs) || question.source_refs.length < 2) {
        return json(req, { error: "At least two web-researched source references are required before approval." }, 422);
      }
      if (question.fact_check_status !== "supported" || Number(question.novelty_score) < 65) {
        return json(req, { error: "Question must pass web fact-checking and the minimum rarity score before approval." }, 422);
      }
    }

    const nextStatus = action === "approve" ? "approved" : "rejected";
    const timestamp = new Date().toISOString();
    const combinedNotes = `${question.fact_check_notes || ""}\n\nHuman ${action} (${timestamp}): ${reviewerNote}`.trim();
    const { data: updated, error: updateError } = await admin.from("questions")
      .update({ review_status: nextStatus, fact_check_notes: combinedNotes, published_at: action === "approve" ? timestamp : null })
      .eq("id", questionId)
      .in("review_status", ["draft", "fact_checked"])
      .select("id,slug,review_status,published_at")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return json(req, { error: "Question changed during review. Refresh the queue and try again." }, 409);

    const { error: auditError } = await admin.from("question_review_events").insert({
      question_id: questionId,
      action,
      reviewer_note: reviewerNote,
      automated_review_status: question.automated_review_status || "not_run",
    });
    if (auditError) throw auditError;
    return json(req, { status: "ok", question: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Question review failed.";
    return json(req, { error: message }, 500);
  }
});
