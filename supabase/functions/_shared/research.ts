export type WebCitation = { title: string; url: string };

function collectCitations(value: unknown, output: WebCitation[] = []): WebCitation[] {
  if (!value || typeof value !== "object") return output;
  if (Array.isArray(value)) {
    for (const item of value) collectCitations(item, output);
    return output;
  }
  const record = value as Record<string, unknown>;
  if (record.type === "url_citation" && typeof record.url === "string") {
    try {
      const parsed = new URL(record.url);
      if (parsed.protocol === "https:") {
        output.push({
          title: typeof record.title === "string" && record.title.trim() ? record.title.trim() : parsed.hostname,
          url: parsed.toString(),
        });
      }
    } catch { /* Ignore malformed citation URLs. */ }
  }
  for (const child of Object.values(record)) collectCitations(child, output);
  return output;
}

export async function researchWithWebSearch(input: string): Promise<{ result: Record<string, unknown>; citations: WebCitation[] }> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured in Supabase secrets.");
  const model = Deno.env.get("OPENAI_RESEARCH_MODEL") || "gpt-6-astra";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      tools: [{ type: "web_search", search_context_size: "high" }],
      tool_choice: "auto",
      max_output_tokens: 2200,
      input: [
        {
          role: "system",
          content: [{
            type: "input_text",
            text: "You are a rigorous educational fact-checker. Use web_search to inspect reliable primary or expert sources. Never invent citations, URLs, quotations, or evidence. Prefer universities, museums, scientific organizations, government agencies, peer-reviewed publications, and recognized reference institutions. If evidence is insufficient or conflicting, say uncertain. Estimate how uncommon the underlying fact is in general quiz/trivia content; this is an editorial estimate, not a claim about what every person has seen. Return JSON only.",
          }],
        },
        { role: "user", content: [{ type: "input_text", text: input }] },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenAI web research failed (${response.status}): ${detail.slice(0, 500)}`);
  }
  const payload = await response.json();
  const message = Array.isArray(payload.output)
    ? payload.output.find((item: any) => item?.type === "message")
    : null;
  const textPart = Array.isArray(message?.content)
    ? message.content.find((item: any) => item?.type === "output_text")
    : null;
  if (typeof textPart?.text !== "string") throw new Error("Web research returned no structured result.");
  let result: Record<string, unknown>;
  try {
    // Web Search is incompatible with Responses API JSON mode. Ask for JSON in
    // the prompt, then defensively extract the object from the plain-text reply.
    const raw = textPart.text.trim();
    const unfenced = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const firstBrace = unfenced.indexOf("{");
    const lastBrace = unfenced.lastIndexOf("}");
    const jsonText = firstBrace >= 0 && lastBrace > firstBrace
      ? unfenced.slice(firstBrace, lastBrace + 1)
      : unfenced;
    const parsed = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Expected a JSON object.");
    }
    result = parsed as Record<string, unknown>;
  } catch {
    throw new Error("Web research returned invalid JSON.");
  }
  const citations = collectCitations(payload.output);
  const unique = new Map<string, WebCitation>();
  for (const citation of citations) unique.set(citation.url, citation);
  return { result, citations: [...unique.values()] };
}
