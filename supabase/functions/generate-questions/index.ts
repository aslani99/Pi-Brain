// Admin-only AI draft generation. This endpoint is NOT callable from the player UI.
// Generated questions are saved as draft and are never playable until human review.
import { handleOptions, json } from "../_shared/http.ts";
import { getAdminClient } from "../_shared/supabase.ts";

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

function fingerprint(value: string): Promise<string> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(value.trim().toLocaleLowerCase().replace(/\s+/g, " ")))
    .then((hash) => Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join(""));
}

Deno.serve(async (req) => {
  const early = handleOptions(req);
  if (early) return early;
  try {
    const configuredSecret = Deno.env.get("PI_BRAIN_ADMIN_SECRET");
    const providedSecret = req.headers.get("x-pi-admin-secret") || "";
    if (!configuredSecret || !(await sameSecret(providedSecret, configuredSecret))) {
      return json(req, { error: "Admin authorization failed." }, 401);
    }

    const body = await req.json();
    const category = typeof body.category === "string" ? body.category.trim().slice(0, 64) : "General";
    const locale = typeof body.locale === "string" && /^[a-z]{2}(-[A-Z]{2})?$/.test(body.locale) ? body.locale : "en";
    const count = Math.min(200, Math.max(1, Number.isInteger(body.count) ? body.count : 25));
    const difficulty = ["easy", "medium", "hard", "very_hard", "expert", "mixed"].includes(body.difficulty) ? body.difficulty : "mixed";
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json(req, { error: "OPENAI_API_KEY is not configured in Supabase secrets." }, 503);

    const admin = getAdminClient();
    const { data: previousQuestions, error: previousError } = await admin.from("questions")
      .select("prompt").eq("category", category).eq("locale", locale)
      .neq("review_status", "rejected").order("created_at", { ascending: false }).limit(120);
    if (previousError) throw previousError;
    const alreadyUsed = (previousQuestions ?? []).map((item: { prompt: string }) => `- ${item.prompt}`).join("\n");
    const prompt = `Create ${count} original multiple-choice trivia questions. Topic: ${category}. Language: ${locale}. Difficulty: ${difficulty}. Write every question from scratch; do not imitate or reproduce quiz-bank wording. Avoid duplicates not only in phrasing but also in the underlying fact, answer, or learning objective. These questions have already been used in this topic and language; do not ask about the same facts or concepts again:\n${alreadyUsed || "(No existing questions in this category and locale.)"}\nAvoid ambiguous wording, stereotypes, medical/legal advice, and political persuasion. Each question must have exactly four options, one defensible correct answer, a concise explanation, and source references that a human editor can use to verify the fact. Do not claim that anything has been verified. Return JSON only in this shape: {"questions":[{"prompt":"...","options":["...","...","...","..."],"answer_index":0,"difficulty":"easy|medium|hard|very_hard|expert","explanation":"...","source_refs":[{"title":"...","url":"https://..."}]}]}.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini",
        temperature: 0.85,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You write original educational quiz material. Be careful, accurate, inclusive, and transparent. Never claim that generated facts have been verified." },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) return json(req, { error: `AI provider request failed (${response.status}).` }, 502);
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") return json(req, { error: "AI provider returned an empty response." }, 502);
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed.questions)) return json(req, { error: "AI response did not contain a questions array." }, 502);

    const seen = new Set<string>();
    const rows: Array<Record<string, unknown>> = [];
    for (const q of parsed.questions) {
      if (typeof q?.prompt !== "string" || q.prompt.trim().length < 12 || q.prompt.length > 500
        || !Array.isArray(q.options) || q.options.length !== 4
        || q.options.some((option: unknown) => typeof option !== "string" || option.length > 180)
        || !Number.isInteger(q.answer_index) || q.answer_index < 0 || q.answer_index > 3
        || typeof q.explanation !== "string" || q.explanation.length > 1200) continue;
      const fp = await fingerprint(q.prompt);
      if (seen.has(fp)) continue;
      seen.add(fp);
      const qDifficulty = ["easy", "medium", "hard", "very_hard", "expert"].includes(q.difficulty) ? q.difficulty : (difficulty === "mixed" ? "medium" : difficulty);
      const sourceRefs = Array.isArray(q.source_refs) ? q.source_refs.slice(0, 5).filter((ref: any) =>
        ref && typeof ref.title === "string" && typeof ref.url === "string" && /^https:\/\//.test(ref.url)
      ) : [];
      rows.push({
        slug: `ai-${crypto.randomUUID()}`,
        category,
        difficulty: qDifficulty,
        locale,
        prompt: q.prompt.trim(),
        options: q.options,
        answer_index: q.answer_index,
        explanation: q.explanation.trim(),
        provenance: "ai-generated-original",
        review_status: "draft",
        fact_check_notes: "AI-generated. Not fact-checked. Human review required before publication.",
        source_refs: sourceRefs,
        prompt_fingerprint: fp,
      });
    }
    if (!rows.length) return json(req, { error: "No valid unique questions passed structural validation.", saved: 0 }, 422);

    const fingerprints = rows.map((row) => row.prompt_fingerprint as string);
    const { data: existing, error: existingError } = await admin.from("questions")
      .select("prompt_fingerprint").in("prompt_fingerprint", fingerprints);
    if (existingError) throw existingError;
    const existingSet = new Set((existing ?? []).map((row: { prompt_fingerprint: string | null }) => row.prompt_fingerprint).filter((value: string | null): value is string => typeof value === "string"));
    const exactFreshRows = rows.filter((row) => !existingSet.has(row.prompt_fingerprint as string));
    if (!exactFreshRows.length) {
      return json(req, { status: "no_new_questions", saved: 0, duplicates_or_conflicts: rows.length, review_status: "draft" });
    }
    const { data: nearDuplicates, error: nearDuplicateError } = await admin.rpc("find_near_duplicate_question_prompts", {
      p_prompts: exactFreshRows.map((row) => row.prompt as string),
      p_threshold: 0.72,
    });
    if (nearDuplicateError) throw nearDuplicateError;
    const nearDuplicateSet = new Set((nearDuplicates ?? []).map((item: { candidate_prompt: string }) => item.candidate_prompt));
    const freshRows = exactFreshRows.filter((row) => !nearDuplicateSet.has(row.prompt as string));
    if (!freshRows.length) {
      return json(req, { status: "no_new_questions", saved: 0, duplicates_or_conflicts: rows.length, review_status: "draft" });
    }
    const { data: saved, error } = await admin.from("questions").insert(freshRows)
      .select("id,slug,category,difficulty,locale,prompt,review_status,created_at");
    if (error) throw error;
    return json(req, {
      status: "drafts_saved_not_verified",
      saved: saved?.length ?? 0,
      duplicates_or_conflicts: rows.length - (saved?.length ?? 0),
      review_status: "draft",
      note: "Review facts and sources manually. Only set review_status=approved after verification.",
      questions: saved ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Question generation failed.";
    return json(req, { error: message }, 500);
  }
});
