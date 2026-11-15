export type VerifiedPiUser = { uid: string; username: string };

export async function verifyPiAccessToken(accessToken: string): Promise<VerifiedPiUser> {
  const apiBase = (Deno.env.get("PI_API_BASE_URL") || "https://api.minepi.com/v2").replace(/\/$/, "");
  const response = await fetch(`${apiBase}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(12_000),
  });
  if (response.status === 401 || response.status === 403) throw new Error("Pi access token is invalid or expired. Please sign in again.");
  if (!response.ok) throw new Error(`Pi identity verification failed (${response.status}).`);
  const user = await response.json();
  if (typeof user?.uid !== "string" || typeof user?.username !== "string") {
    throw new Error("Pi returned an unexpected identity response.");
  }
  return { uid: user.uid, username: user.username };
}
