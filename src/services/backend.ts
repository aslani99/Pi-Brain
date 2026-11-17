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

export type QuizDifficulty = "easy" | "medium" | "hard" | "very_hard" | "expert";

export type ServerQuestion = {
  id: string;
  category: string;
  difficulty: QuizDifficulty;
  prompt: string;
  options: string[];
};

export type QuizCatalog = {
  categories: string[];
  progress: Record<string, number>;
};

export type QuizSessionStart = {
  session_id: string;
  path_key: string;
  stage: number;
  question_count: number;
  difficulty: QuizDifficulty;
  bank_status?: "BANK_AVAILABLE";
  locale?: string;
  current_index: number;
  score: number;
  resumed: boolean;
  questions: ServerQuestion[];
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
      // Pi access tokens are verified by the Edge Function, not Supabase Auth.
      Authorization: `Bearer ${piAccessToken}`,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const message = typeof payload.error === "string" ? payload.error : `Backend request failed (${response.status}).`;
    const failure = new Error(message) as Error & { code?: string };
    if (typeof payload.code === "string") failure.code = payload.code;
    throw failure;
  }
  return payload as T;
}

export function verifyPiOnBackend(accessToken: string, locale: string) {
  return invoke<{ ok: true; profile: PiVerifiedProfile }>("pi-auth", accessToken, { locale });
}

export function fetchLeaderboard(accessToken: string) {
  return invoke<{ entries: LeaderboardEntry[] }>("leaderboard", accessToken, { limit: 50 });
}

export function fetchQuizCatalog(accessToken: string, locale: string) {
  return invoke<QuizCatalog>("quiz-catalog", accessToken, { locale });
}

export function startServerQuiz(accessToken: string, pathKey: string, locale: string) {
  return invoke<QuizSessionStart>("start-quiz", accessToken, { path_key: pathKey, locale });
}

export function fetchNextServerQuestion(accessToken: string, sessionId: string) {
  return invoke<{
    question: ServerQuestion;
    question_index: number;
    stage: number;
    question_count: number;
    difficulty: QuizDifficulty;
    path_key: string;
  }>("next-question", accessToken, { session_id: sessionId });
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
    stage: number;
    next_stage: number;
    stage_advanced: boolean;
    duplicate?: boolean;
    profile: Pick<PiVerifiedProfile, "total_xp" | "total_answered" | "total_correct" | "day_streak" | "last_active_date">;
  }>("submit-answer", accessToken, {
    session_id: sessionId,
    question_id: questionId,
    selected_index: selectedIndex,
  });
}


export type UserPreferences = {
  language: string;
  quizLanguage: string;
  theme: string;
  soundEnabled: boolean;
  reducedMotion: boolean;
};

export type UserPreferencesResult = {
  preferences: UserPreferences;
  version: number;
  updated_at: string | null;
};

export function fetchUserPreferences(accessToken: string) {
  return invoke<UserPreferencesResult>("user-preferences", accessToken, {});
}

export function saveUserPreferences(
  accessToken: string,
  preferences: UserPreferences,
  expectedVersion: number,
) {
  return invoke<UserPreferencesResult>("save-user-preferences", accessToken, {
    preferences,
    expected_version: expectedVersion,
  });
}
