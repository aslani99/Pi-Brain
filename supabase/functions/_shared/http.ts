function isOriginAllowed(req: Request): boolean {
  const configuredOrigin = Deno.env.get("APP_ALLOWED_ORIGIN");
  const requestOrigin = req.headers.get("origin");
  // During local setup the origin is open; production should set the exact HTTPS app origin.
  return !configuredOrigin || !requestOrigin || requestOrigin === configuredOrigin;
}

export function corsHeaders(req: Request): Record<string, string> {
  const configuredOrigin = Deno.env.get("APP_ALLOWED_ORIGIN");
  const requestOrigin = req.headers.get("origin");
  return {
    "Access-Control-Allow-Origin": configuredOrigin ? (requestOrigin === configuredOrigin ? configuredOrigin : "null") : "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-pi-admin-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export function handleOptions(req: Request): Response | null {
  if (!isOriginAllowed(req)) {
    return new Response(JSON.stringify({ error: "Origin is not allowed." }), {
      status: 403,
      headers: { "Content-Type": "application/json; charset=utf-8", "Vary": "Origin" },
    });
  }
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  return null;
}

export function bearerToken(req: Request): string | null {
  const value = req.headers.get("authorization") ?? "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}
