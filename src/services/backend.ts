export type PiVerifiedProfile = {
  id: string;
  pi_uid: string;
  username: string;
  display_name: string | null;
  locale: string;
  total_xp: number;
  total_answered: number;
  total_correct: number;
  day_streak: number;
  last_active_date: string | null;
};

export type LeaderboardEntry = {
  rank: number;
  username: string;
  total_xp: number;
};

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  ?? import.meta.env.VITE_SUPABASE_ANON_KEY
  ?? "";

export function isBackendConfigured(): boolean {
  return Boolean(supabaseUrl && publishableKey);
}

async function invoke<T>(
  functionName: string,
  piAccessToken: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  if (!isBackendConfigured()) {
    throw new Error("Backend is not configured. Add the Supabase URL and publishable key to .env.local.");
  }
  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: publishableKey,
      // Edge Functions verify the Pi access token themselves. Supabase verify_jwt
      // is disabled for these endpoints in supabase/config.toml by design.
      Authorization: `Bearer ${piAccessToken}`,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const message = typeof payload.error === "string" ? payload.error : `Backend request failed (${response.status}).`;
    throw new Error(message);
  }
  return payload as T;
}

export function verifyPiOnBackend(accessToken: string, locale: string) {
  return invoke<{ ok: true; profile: PiVerifiedProfile }>("pi-auth", accessToken, { locale });
}

export function fetchLeaderboard(accessToken: string) {
  return invoke<{ entries: LeaderboardEntry[] }>("leaderboard", accessToken, { limit: 50 });
}

export function startServerQuiz(accessToken: string, category: string, locale: string) {
  return invoke<{
    session_id: string;
    questions: Array<{
      id: string;
      category: string;
      difficulty: "easy" | "medium" | "hard";
      prompt: string;
      options: string[];
    }>;
  }>("start-quiz", accessToken, { category, locale, count: 5 });
}

export function submitServerAnswer(
  accessToken: string,
  sessionId: string,
  questionId: string,
  selectedIndex: number,
) {
  return invoke<{
    correct: boolean;
    answer_index: number;
    explanation: string;
    points_awarded: number;
    score: number;
    completed: boolean;
    duplicate?: boolean;
    profile: Pick<PiVerifiedProfile, "total_xp" | "total_answered" | "total_correct" | "day_streak" | "last_active_date">;
  }>("submit-answer", accessToken, {
    session_id: sessionId,
    question_id: questionId,
    selected_index: selectedIndex,
  });
}
