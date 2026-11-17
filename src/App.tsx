import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Activity, Atom, Award, BrainCircuit, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Cpu, Flame, Globe2, Home, Languages, Leaf, Lightbulb, LockKeyhole, Menu, Palette, Play, Sparkles, Star, Trophy, UserRound, X, Orbit, Shapes, Volume2, VolumeX, Sun, CheckCircle2, Shuffle } from "lucide-react";
import i18n, { applyLocale, localeOptions, normalizeLocale } from "./i18n/config";
import { hasQuestionTranslation, localizeCategory, localizeCategoryDescription, localizeDifficulty, localizeQuestion } from "./i18n/question-translations";
import { categories, questions, type Question } from "./data";
import { playUiSound, startAmbientMusic, stopAmbientMusic } from "./audio";
import { authenticatePiUser, isPiSdkAvailable } from "./services/pi";
import { fetchLeaderboard, fetchNextServerQuestion, fetchQuizCatalog, isBackendConfigured, startServerQuiz, submitServerAnswer, type LeaderboardEntry, type PiVerifiedProfile, type ServerQuestion, type UserPreferences, fetchUserPreferences, saveUserPreferences } from "./services/backend";

const iconMap: Record<string, any> = { Atom, Globe2, Cpu, Leaf, BrainCircuit, Palette, Orbit, Shapes, Shuffle };
const themes = [
  { id: "cosmic", name: "Cosmic", fa: "کیهانی", colors: ["#120b32", "#925eff", "#4ce4ff", "#ffd05b"], mode: "dark" },
  { id: "light", name: "Light", fa: "روشن", colors: ["#f4f6ff", "#7655e8", "#23a9c8", "#e6a52c"], mode: "light" },
  { id: "ocean", name: "Ocean", fa: "اقیانوسی", colors: ["#071d35", "#1688c9", "#49e0e1", "#f4c96b"], mode: "dark" },
  { id: "aurora", name: "Aurora", fa: "شفق قطبی", colors: ["#0b2030", "#16a58c", "#78e6c3", "#d5f477"], mode: "dark" },
  { id: "sunset", name: "Sunset", fa: "غروب", colors: ["#2a102b", "#e45e87", "#ff9d66", "#ffd078"], mode: "dark" },
  { id: "royal", name: "Royal", fa: "سلطنتی", colors: ["#17102d", "#7350bc", "#b28aff", "#e7c16c"], mode: "dark" },
  { id: "rose", name: "Rose", fa: "رز", colors: ["#2a1024", "#d85b9b", "#ff9cc9", "#ffd2a1"], mode: "dark" }
];
type LocalStats = {
  totalXp: number;
  totalAnswered: number;
  totalCorrect: number;
  dayStreak: number;
  lastPlayedDate: string | null;
};

const EMPTY_STATS: LocalStats = {
  totalXp: 0,
  totalAnswered: 0,
  totalCorrect: 0,
  dayStreak: 0,
  lastPlayedDate: null
};

function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function previousDayKey() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function mapServerQuestion(item: ServerQuestion): Question {
  const difficulty = item.difficulty.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) as Question["difficulty"];
  return {
    id: item.id,
    category: item.category,
    difficulty,
    prompt: item.prompt,
    options: item.options,
    // The correct answer and explanation remain server-only until grading.
    answer: -1,
    explanation: "",
    provenance: "AI-generated-original",
    reviewStatus: "human-reviewed-demo",
  };
}

function readLocalStats(): LocalStats {
  try {
    const raw = localStorage.getItem("pi-brain-local-stats");
    if (!raw) return EMPTY_STATS;
    const parsed = JSON.parse(raw) as Partial<LocalStats>;
    return {
      totalXp: Number.isFinite(parsed.totalXp) ? Math.max(0, Number(parsed.totalXp)) : 0,
      totalAnswered: Number.isFinite(parsed.totalAnswered) ? Math.max(0, Number(parsed.totalAnswered)) : 0,
      totalCorrect: Number.isFinite(parsed.totalCorrect) ? Math.max(0, Number(parsed.totalCorrect)) : 0,
      dayStreak: Number.isFinite(parsed.dayStreak) ? Math.max(0, Number(parsed.dayStreak)) : 0,
      lastPlayedDate: typeof parsed.lastPlayedDate === "string" ? parsed.lastPlayedDate : null
    };
  } catch {
    return EMPTY_STATS;
  }
}

const PREFERENCES_CACHE_KEY = "pi-brain-preferences-v1";
const preferencesCacheKey = (piUid?: string | null) =>
  piUid ? `${PREFERENCES_CACHE_KEY}:${piUid}` : PREFERENCES_CACHE_KEY;
const DEFAULT_PREFERENCES: UserPreferences = {
  language: "en",
  quizLanguage: "en",
  theme: "cosmic",
  soundEnabled: true,
  reducedMotion: false,
};

function readLocalPreferences(cacheKey = PREFERENCES_CACHE_KEY): UserPreferences {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) {
      const legacyTheme = cacheKey === PREFERENCES_CACHE_KEY
        ? localStorage.getItem("pi-brain-theme")
        : null;
      const initialLanguage = normalizeLocale(i18n.language);
      return {
        ...DEFAULT_PREFERENCES,
        language: initialLanguage,
        quizLanguage: initialLanguage,
        theme: themes.some((item) => item.id === legacyTheme) ? legacyTheme! : "cosmic",
      };
    }
    const value = JSON.parse(raw) as Partial<UserPreferences>;
    const language = normalizeLocale(typeof value.language === "string" ? value.language : i18n.language);
    return {
      language,
      quizLanguage: language,
      theme: themes.some((item) => item.id === value.theme) ? value.theme! : "cosmic",
      soundEnabled: typeof value.soundEnabled === "boolean" ? value.soundEnabled : true,
      reducedMotion: typeof value.reducedMotion === "boolean" ? value.reducedMotion : false,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export default function App() {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<"home"|"quiz"|"result"|"rankings"|"discover"|"profile">("home");
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>(questions);
  const [availableCategories, setAvailableCategories] = useState<typeof categories>([]);
  const [categoryStages, setCategoryStages] = useState<Record<string, number>>({});
  const [randomStage, setRandomStage] = useState(1);
  const [quizMeta, setQuizMeta] = useState<{ pathKey: string; stage: number; questionCount: number; difficulty: string } | null>(null);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<number|null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [languageOpen, setLanguageOpen] = useState(false);
  // Quiz language always follows the one selected application language.
  const quizLanguage = normalizeLocale(i18n.language);
  const [themeOpen, setThemeOpen] = useState(false);
  const [theme, setTheme] = useState(() => readLocalPreferences().theme);
  const [reducedMotion, setReducedMotion] = useState(() => readLocalPreferences().reducedMotion);
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  const [syncRetry, setSyncRetry] = useState(0);
  const preferencesVersionRef = useRef(0);
  const catalogRequestRef = useRef(0);
  const preferencesReadyRef = useRef(false);
  const skipNextPreferenceSaveRef = useRef(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [toast, setToast] = useState("");
  const [soundOn, setSoundOn] = useState(() => readLocalPreferences().soundEnabled);
  const [stats, setStats] = useState<LocalStats>(readLocalStats);
  const [piProfile, setPiProfile] = useState<PiVerifiedProfile | null>(null);
  const [piAccessToken, setPiAccessToken] = useState<string | null>(null);
  const [piAuthBusy, setPiAuthBusy] = useState(false);
  const [piAuthMessage, setPiAuthMessage] = useState("");
  const piRestoreAttempted = useRef(false);
  const [remoteSessionId, setRemoteSessionId] = useState<string | null>(null);
  const [remoteFeedback, setRemoteFeedback] = useState<{ questionId: string; correct: boolean; answerIndex: number; explanation: string } | null>(null);
  const [answerSubmitting, setAnswerSubmitting] = useState(false);
  const [liveLeaderboard, setLiveLeaderboard] = useState<LeaderboardEntry[]>([]);
  const sourceCurrent = sessionQuestions[qIndex] ?? sessionQuestions[0] ?? questions[0];
  // Questions delivered by the server are already authored for the requested locale.
  // Only local demo questions should pass through the bundled translation catalogue.
  const current = remoteSessionId ? sourceCurrent : localizeQuestion(sourceCurrent, quizLanguage);
  const progress = ((qIndex + (checked ? 1 : 0)) / Math.max(quizMeta?.questionCount ?? sessionQuestions.length, 1)) * 100;
  const navItems = [
    {id:"home",label:t("home"),icon:Home},{id:"discover",label:t("discover"),icon:Sparkles},
    {id:"rankings",label:t("rankings"),icon:Trophy},{id:"profile",label:t("profile"),icon:UserRound}
  ] as const;
  const localizeError = (error: unknown, fallbackKey: string) => {
    const detail = error instanceof Error ? error.message.toLowerCase() : "";
    const code = error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
    if (code === "LOCALE_QUESTION_BANK_EMPTY") return t("questionBankExhausted");
    if (code === "LOCALE_QUESTION_BANK_EMPTY") return t("questionBankExhausted");
    if (code === "BANK_EMPTY" || detail.includes("bank_empty")) return t("questionBankEmpty");
    if (code === "BANK_EXHAUSTED" || detail.includes("bank_exhausted")) return t("questionBankExhausted");
    if (code === "BANK_TEMPORARILY_UNAVAILABLE" || detail.includes("bank_temporarily_unavailable")) return t("questionBankInsufficient");
    if (code === "INSUFFICIENT_QUESTION_BANK" || detail.includes("insufficient_question_bank")) return t("questionBankInsufficient");
    if (code === "LOCALE_CATEGORY_UNAVAILABLE" || code === "CATEGORY_UNAVAILABLE"
      || detail.includes("locale_category_unavailable")) return t("categoryUnavailable");
    if (detail.includes("invalid or expired") || detail.includes("session has expired")) return t("sessionExpired");
    if (detail.includes("profile not found")) return t("profileNotFound");
    if (detail.includes("unknown or unpublished quiz category")) return t("categoryUnavailable");
    return t(fallbackKey);
  };

  const leaderboardRows = piProfile
    ? liveLeaderboard.map((entry) => [String(entry.rank), entry.username, entry.total_xp.toLocaleString()])
    : [["1","NovaMind","2,840"],["2","CuriousCat","2,610"],["3",t("you"),"2,420"],["4","OrbitFox","2,180"],["5","BlueComet","1,940"]];

  const changeLanguage = async (code: string) => {
    const language = normalizeLocale(code);
    if (view === "quiz") {
      setToast(t("finishQuizBeforeLanguageChange"));
      setLanguageOpen(false);
      return;
    }
    if (language === normalizeLocale(i18n.language)) {
      setLanguageOpen(false);
      return;
    }
    // Discard an old catalog response before requesting the selected locale.
    catalogRequestRef.current += 1;
    setAvailableCategories([]);
    await applyLocale(language);
    setLanguageOpen(false);
    if (!piAccessToken) return;
    const requestId = ++catalogRequestRef.current;
    try {
      const catalog = await fetchQuizCatalog(piAccessToken, language);
      if (requestId !== catalogRequestRef.current) return;
      const metadata = new Map(categories.map((item) => [item.name, item]));
      setAvailableCategories(catalog.categories.map((name, index) => metadata.get(name) ?? ({
        name, icon: "BrainCircuit",
        color: ["violet", "blue", "cyan", "green", "pink", "amber", "indigo", "rose"][index % 8],
        desc: t("approvedCategories"),
      })));
      setCategoryStages(catalog.progress ?? {});
      setRandomStage(catalog.progress?.__random__ ?? 1);
    } catch (error) {
      if (requestId === catalogRequestRef.current) {
        setToast(localizeError(error, "catalogLoadError"));
      }
    }
  };

  const signInWithPi = async (silent = false) => {
    if (!isBackendConfigured()) {
      if (!silent) setPiAuthMessage(t("backendSetup"));
      return;
    }
    if (!silent) {
      try { localStorage.removeItem("pi-brain-explicit-signout"); } catch { /* Storage may be unavailable. */ }
    }
    setPiAuthBusy(true);
    preferencesReadyRef.current = false;
    setPreferencesHydrated(false);
    if (!silent) setPiAuthMessage("");
    let authenticatedQuizLocale = normalizeLocale(i18n.language);
    try {
      const result = await authenticatePiUser(i18n.language);
      setPiProfile(result.profile);
      // Keep the Pi access token in memory only; never persist it in localStorage.
      setPiAccessToken(result.accessToken);
      try {
        const remotePreferences = await fetchUserPreferences(result.accessToken);
        const accountPreferencesKey = preferencesCacheKey(result.profile.pi_uid);
        const localPreferences = readLocalPreferences(accountPreferencesKey);
        let hasCachedPreferences = false;
        try { hasCachedPreferences = Boolean(localStorage.getItem(accountPreferencesKey)); }
        catch { /* The account preferences from Supabase remain authoritative. */ }
        const remote = remotePreferences.preferences;
        const initialAccountLocale = normalizeLocale(result.profile.locale || i18n.language);
        const restored = remotePreferences.version === 0
          ? {
              ...localPreferences,
              language: hasCachedPreferences ? localPreferences.language : initialAccountLocale,
              quizLanguage: hasCachedPreferences ? localPreferences.language : initialAccountLocale,
            }
          : {
              ...DEFAULT_PREFERENCES,
              ...remote,
              quizLanguage: remote.language || result.profile.locale || "en",
            };
        const restoredLanguage = normalizeLocale(restored.language);
        authenticatedQuizLocale = restoredLanguage;
        preferencesVersionRef.current = remotePreferences.version;
        preferencesReadyRef.current = true;
        skipNextPreferenceSaveRef.current = remotePreferences.version > 0;
        await applyLocale(restoredLanguage);
        setTheme(themes.some((item) => item.id === restored.theme) ? restored.theme : "cosmic");
        setSoundOn(restored.soundEnabled);
        setReducedMotion(restored.reducedMotion);
        setPreferencesHydrated(true);
      } catch (preferenceError) {
        preferencesReadyRef.current = false;
        setPreferencesHydrated(false);
        if (!silent) setToast(localizeError(preferenceError, "prefsLoadError"));
      }
      try {
        const catalogRequestId = ++catalogRequestRef.current;
        const catalog = await fetchQuizCatalog(result.accessToken, authenticatedQuizLocale);
        if (catalogRequestId === catalogRequestRef.current) {
          const metadata = new Map(categories.map((item) => [item.name, item]));
          setAvailableCategories(catalog.categories.map((name, index) => metadata.get(name) ?? ({
            name,
            icon: "BrainCircuit",
            color: ["violet", "blue", "cyan", "green", "pink", "amber", "indigo", "rose"][index % 8],
            desc: t("approvedCategories"),
          })));
          setCategoryStages(catalog.progress ?? {});
          setRandomStage(catalog.progress?.__random__ ?? 1);
        }
      } catch (catalogError) {
        if (!silent) setToast(localizeError(catalogError, "catalogLoadError"));
        setAvailableCategories([]);
      }
      try {
        const leaderboard = await fetchLeaderboard(result.accessToken);
        setLiveLeaderboard(leaderboard.entries);
      } catch { setLiveLeaderboard([]); }
      setStats({
        totalXp: result.profile.total_xp,
        totalAnswered: result.profile.total_answered,
        totalCorrect: result.profile.total_correct,
        dayStreak: result.profile.day_streak,
        lastPlayedDate: result.profile.last_active_date,
      });
      if (!silent) {
        setPiAuthMessage(t("piIdentityVerified"));
        if (soundOn) playUiSound("success");
      }
    } catch (error) {
      const message = localizeError(error, "genericError");
      if (!silent) {
        setPiAuthMessage(message);
        setToast(message);
      }
    } finally {
      setPiAuthBusy(false);
    }
  };
  useEffect(() => {
    const preferences: UserPreferences = {
      language: normalizeLocale(i18n.language),
      quizLanguage: normalizeLocale(i18n.language),
      theme,
      soundEnabled: soundOn,
      reducedMotion,
    };
    if (piProfile && !preferencesHydrated) return;
    try {
      localStorage.setItem(preferencesCacheKey(piProfile?.pi_uid), JSON.stringify(preferences));
    }
    catch { /* The in-memory settings remain usable if storage is unavailable. */ }
  }, [i18n.language, quizLanguage, theme, soundOn, reducedMotion, piProfile?.pi_uid, preferencesHydrated]);

  useEffect(() => {
    const retryWhenOnline = () => setSyncRetry((value) => value + 1);
    window.addEventListener("online", retryWhenOnline);
    return () => window.removeEventListener("online", retryWhenOnline);
  }, []);

  useEffect(() => {
    if (!piAccessToken || !preferencesReadyRef.current || !preferencesHydrated) return;
    if (skipNextPreferenceSaveRef.current) {
      skipNextPreferenceSaveRef.current = false;
      return;
    }
    const preferences: UserPreferences = {
      language: normalizeLocale(i18n.language),
      quizLanguage: normalizeLocale(i18n.language),
      theme,
      soundEnabled: soundOn,
      reducedMotion,
    };
    const timeout = window.setTimeout(async () => {
      try {
        const saved = await saveUserPreferences(
          piAccessToken,
          preferences,
          preferencesVersionRef.current,
        );
        preferencesVersionRef.current = saved.version;
      } catch (error) {
        if (error instanceof Error && error.message.includes("another device")) {
          try {
            const latest = await fetchUserPreferences(piAccessToken);
            preferencesVersionRef.current = latest.version;
            skipNextPreferenceSaveRef.current = true;
            await applyLocale(latest.preferences.language);
            setTheme(themes.some((item) => item.id === latest.preferences.theme) ? latest.preferences.theme : "cosmic");
            setSoundOn(latest.preferences.soundEnabled);
            setReducedMotion(latest.preferences.reducedMotion);
            setToast(t("settingsRestoredFromAnotherDevice"));
          } catch {
            setToast(t("prefsSyncError"));
          }
        } else {
          setToast(localizeError(error, "prefsSyncError"));
        }
      }
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [piAccessToken, preferencesHydrated, syncRetry, i18n.language, quizLanguage, theme, soundOn, reducedMotion]);

  useEffect(() => {
    if (piRestoreAttempted.current) return;
    piRestoreAttempted.current = true;

    let explicitlySignedOut = false;
    try { explicitlySignedOut = localStorage.getItem("pi-brain-explicit-signout") === "true"; } catch { /* Continue with SDK restoration. */ }

    if (!explicitlySignedOut && isPiSdkAvailable() && isBackendConfigured()) {
      void signInWithPi(true);
    }
  }, []);
  const signOutPi = () => {
    try { localStorage.setItem("pi-brain-explicit-signout", "true"); } catch { /* Sign-out still applies in memory. */ }
    catalogRequestRef.current += 1;
    setPiProfile(null);
    setPiAccessToken(null);
    preferencesReadyRef.current = false;
    setPreferencesHydrated(false);
    preferencesVersionRef.current = 0;
    setAvailableCategories([]);
    setCategoryStages({});
    setRandomStage(1);
    setRemoteSessionId(null);
    setRemoteFeedback(null);
    setLiveLeaderboard([]);
    setPiAuthMessage(t("signedOut"));
    setStats(readLocalStats());
  };
  const changeTheme = (id:string) => {
    setTheme(id);
    setThemeOpen(false);
    if (soundOn) playUiSound("select");
  };
  const toggleSound = () => { const next = !soundOn; setSoundOn(next); if (next) startAmbientMusic(); else stopAmbientMusic(); };
  const startQuiz = async (category?:string) => {
    const pathKey = category || "__random__";
    if (piAccessToken) {
      try {
        const remote = await startServerQuiz(piAccessToken, pathKey, quizLanguage);
        const firstQuestion = remote.questions[0];
        if (!firstQuestion) throw new Error(t("serverQuestionLoadError"));
        const resumedQuestion = mapServerQuestion(firstQuestion);
        const resumedIndex = Math.max(0, remote.current_index ?? 0);
        // Keep the current server question at its absolute session index so
        // the existing next-question flow continues from the resumed position.
        setSessionQuestions(Array.from({ length: resumedIndex + 1 }, () => resumedQuestion));
        setRemoteSessionId(remote.session_id);
        setQuizMeta({
          pathKey: remote.path_key,
          stage: remote.stage,
          questionCount: remote.question_count,
          difficulty: remote.difficulty.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
        });
        setRemoteFeedback(null);
        setQIndex(resumedIndex);
        setSelected(null);
        setChecked(false);
        setScore(remote.score ?? 0);
        setView("quiz");
        return;
      } catch (error) {
        // A Pi-authenticated user must never silently fall back to local demo data.
        setToast(localizeError(error, "genericError"));
        return;
      }
    }

    // Never substitute local English demo questions for missing reviewed locale content.
    setToast(t("signInForLeaderboard"));
  };
  const chooseAnswer = (idx:number) => { if (!checked && !answerSubmitting) setSelected(idx); };
  const checkAnswer = async () => {
    if (selected===null || checked || answerSubmitting) return;

    if (remoteSessionId && piAccessToken) {
      setAnswerSubmitting(true);
      try {
        const result = await submitServerAnswer(piAccessToken, remoteSessionId, current.id, selected);
        setRemoteFeedback({ questionId: current.id, correct: result.correct, answerIndex: result.answer_index, explanation: result.explanation });
        setChecked(true);
        setScore(result.score);
        if (result.completed) {
          // A retry can report an already-completed session with stage_advanced=false.
          // The authoritative next_stage is still safe to reflect in the UI.
          setCategoryStages((currentStages) => ({ ...currentStages, [quizMeta?.pathKey ?? "__random__"]: result.next_stage }));
          if ((quizMeta?.pathKey ?? "__random__") === "__random__") setRandomStage(result.next_stage);
        }
        setStats({
          totalXp: result.profile.total_xp,
          totalAnswered: result.profile.total_answered,
          totalCorrect: result.profile.total_correct,
          dayStreak: result.profile.day_streak,
          lastPlayedDate: result.profile.last_active_date,
        });
        setPiProfile((profile) => profile ? { ...profile, ...result.profile } : profile);
        // Refresh live rankings after each server-graded answer.
        void fetchLeaderboard(piAccessToken).then((leaderboard) => setLiveLeaderboard(leaderboard.entries)).catch(() => undefined);
        if (result.correct) { if (soundOn) playUiSound("success"); }
        else if (soundOn) playUiSound("select");
      } catch (error) {
        setToast(localizeError(error, "answerSaveError"));
      } finally {
        setAnswerSubmitting(false);
      }
      return;
    }

    const isCorrect = selected === current.answer;
    setChecked(true);
    if (isCorrect) { setScore(s=>s+1); if (soundOn) playUiSound("success"); }
    else if (soundOn) playUiSound("select");

    const today = todayKey();
    const nextStreak = stats.lastPlayedDate === today
      ? stats.dayStreak
      : stats.lastPlayedDate === previousDayKey() ? stats.dayStreak + 1 : 1;
    const nextStats: LocalStats = {
      totalXp: stats.totalXp + (isCorrect ? 15 : 0),
      totalAnswered: stats.totalAnswered + 1,
      totalCorrect: stats.totalCorrect + (isCorrect ? 1 : 0),
      dayStreak: nextStreak,
      lastPlayedDate: today
    };
    setStats(nextStats);
    try { localStorage.setItem("pi-brain-local-stats", JSON.stringify(nextStats)); }
    catch { /* Progress remains available in memory for this session. */ }
  };
  const nextQuestion = async () => {
    const totalQuestions = quizMeta?.questionCount ?? sessionQuestions.length;
    if (qIndex >= totalQuestions - 1) { setView("result"); return; }

    if (remoteSessionId && piAccessToken) {
      setQuestionLoading(true);
      try {
        const delivered = await fetchNextServerQuestion(piAccessToken, remoteSessionId);
        const next = mapServerQuestion(delivered.question);
        setSessionQuestions((currentQuestions) => [...currentQuestions.slice(0, qIndex + 1), next]);
        setQIndex((index) => index + 1);
        setSelected(null);
        setChecked(false);
        setRemoteFeedback(null);
      } catch (error) {
        setToast(localizeError(error, "genericError"));
      } finally {
        setQuestionLoading(false);
      }
      return;
    }

    setQIndex((index) => index + 1);
    setSelected(null);
    setChecked(false);
    setRemoteFeedback(null);
  };

  return <MotionConfig reducedMotion={reducedMotion ? "always" : "user"}><div className="app-shell" data-theme={theme} data-reduced-motion={reducedMotion ? "true" : "false"} onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => { const target = event.target as HTMLElement; if (soundOn && target.closest("button")) { startAmbientMusic(); playUiSound("tap"); } }}>
    <header className="topbar">
      <button className="brand" onClick={()=>setView("home")} aria-label={t("brandHomeLabel")}>
        <span className="brand-mark"><Orbit size={22}/></span><span>pi<span className="brand-accent">brain</span></span><span className="brand-beta">{t("cosmicQuiz")}</span>
      </button>
      <nav className="desktop-nav">{navItems.map(n=><motion.button key={n.id} className={view===n.id?"nav-link active":"nav-link"} onClick={()=>setView(n.id)} whileTap={{scale:.9}} transition={{type:"spring",stiffness:500,damping:20}}><n.icon size={17}/>{n.label}</motion.button>)}</nav>
      <div className="top-actions">
        <div className="theme-wrap">
          <motion.button className="icon-button theme-button" onClick={()=>{setThemeOpen(v=>!v);setLanguageOpen(false)}} whileTap={{scale:.86,rotate:18}} aria-label={t("chooseTheme")} aria-expanded={themeOpen} title={t("chooseTheme")}><Palette size={17}/><span>{t("themes").toUpperCase()}</span></motion.button>
          <AnimatePresence>{themeOpen&&<motion.div className="theme-menu" initial={{opacity:0,y:12,scale:.94,filter:"blur(5px)"}} animate={{opacity:1,y:0,scale:1,filter:"blur(0px)"}} exit={{opacity:0,y:8,scale:.96}} transition={{type:"spring",stiffness:420,damping:25}}><div className="theme-menu-head"><div><b>{t("chooseUniverse")}</b><small>{t("personalizeAppearance")}</small></div><button className="theme-close" onClick={()=>setThemeOpen(false)} aria-label={t("close")}><X size={15}/></button></div><div className="theme-options">{themes.map((item,i)=><motion.button key={item.id} className={`theme-option ${theme===item.id?"active":""}`} onClick={()=>changeTheme(item.id)} whileHover={{x:4,scale:1.015}} whileTap={{scale:.96}} initial={{opacity:0,x:10}} animate={{opacity:1,x:0}} transition={{delay:i*.035}}><span className="theme-swatches">{item.colors.map((color,j)=><i key={j} style={{background:color}}/>)}</span><span className="theme-name"><b>{t(`theme${item.id[0].toUpperCase()}${item.id.slice(1)}`)}</b><small>{item.mode==="light"?t("lightMode"):t("darkMode")}</small></span>{theme===item.id&&<CheckCircle2 size={17}/>}</motion.button>)}</div><div className="theme-tip"><Sun size={13}/> {t("lightThemeTip")}</div><button className="theme-motion-toggle" onClick={()=>setReducedMotion(value=>!value)} aria-pressed={reducedMotion}>{t("reduceMotion")}<span>{reducedMotion ? t("on") : t("off")}</span></button></motion.div>}</AnimatePresence>
        </div>
        <button className={`icon-button sound-button ${soundOn ? "sound-on" : ""}`} onClick={toggleSound} aria-label={soundOn ? t("muteSound") : t("enableSound")} title={soundOn ? t("soundOn") : t("soundOff")}>{soundOn ? <Volume2 size={17}/> : <VolumeX size={17}/>}<span>{soundOn ? t("soundOn").toUpperCase() : t("soundOff").toUpperCase()}</span></button>
        <div className="language-wrap">
          <button className="icon-button language-button" onClick={()=>{setLanguageOpen(v=>!v);setThemeOpen(false)}} aria-label={t("languages")} title={t("languages")} aria-expanded={languageOpen}><Languages size={17}/><span>{normalizeLocale(i18n.language).toUpperCase()}</span><ChevronDown size={14}/></button>
          <AnimatePresence>{languageOpen&&<motion.div className="language-menu language-menu-expanded" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:8}}>

            {localeOptions.map(([code,label])=>{
              const selectedLanguage = normalizeLocale(i18n.language);
              return <button key={code} onClick={()=>void changeLanguage(code)} className={selectedLanguage===code?"selected":""}>{label}{selectedLanguage===code&&<Check size={14}/>}</button>;
            })}
          </motion.div>}</AnimatePresence>
        </div>
        <button className="avatar" onClick={()=>setView("profile")} aria-label={t("openProfile")}>{piProfile?.username?.charAt(0)?.toUpperCase() || "G"}</button>
        <button className="mobile-menu-button" onClick={()=>setMobileMenu(v=>!v)} aria-label={mobileMenu ? t("closeMenu") : t("openMenu")} aria-expanded={mobileMenu}><Menu/></button>
      </div>
    </header>

    {mobileMenu&&<div className="mobile-menu">{navItems.map(n=><button key={n.id} onClick={()=>{setView(n.id);setMobileMenu(false)}}><n.icon size={17}/>{n.label}</button>)}</div>}

    <main className="main-content">
      <AnimatePresence mode="wait">
      {view==="home"&&<motion.div key="home" className="page" initial={{opacity:0,scale:.965,y:28,filter:"blur(8px)"}} animate={{opacity:1,scale:1,y:0,filter:"blur(0px)"}} exit={{opacity:0,scale:.985,y:-18,filter:"blur(6px)"}} transition={{type:"spring",stiffness:250,damping:25}}>
        <div className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/>{t("welcome")}</div><h1>{t("greeting")}</h1><p className="muted">{t("subtitle")}</p></div><div className="level-pill"><Sparkles size={15}/>{t("level")}</div></div>
        <section className="hero-card">
          <div className="hero-copy"><div className="hero-kicker"><span className="sun-dot"/> {t("daily")} <span className="hero-live">{t("liveQuest")}</span></div><h2>{t("heroTitleLine1")}<br/><span>{t("heroTitleLine2")}</span></h2><p>{t("heroDescription")}</p><motion.button className="primary-button hero-cta" onClick={()=>{if (!piAccessToken) {setToast(t("signInForLeaderboard")); return;} if (!availableCategories.length) {setToast(t("questionBankEmpty")); return;} void startQuiz();}} whileHover={{scale:1.035,y:-3}} whileTap={{scale:.94,y:2}} transition={{type:"spring",stiffness:420,damping:17}}><span className="cta-icon"><Play size={16} fill="currentColor"/></span>{t("start")}<ChevronRight size={17}/><span className="button-shine"/></motion.button><div className="hero-meta"><span><ClockIcon/> {t("minutes")}</span><span><CircleHelp size={14}/> {t("stageBasedQuiz")}</span><span><Star size={14}/> +120 XP</span></div></div>
          <div className="hero-art"><div className="robot-aura"/><img src="/assets/pi-brain-robot.png" alt={t("coPilot")}/><div className="robot-orbit orbit-a"/><div className="robot-orbit orbit-b"/><div className="mascot-tag"><Sparkles size={14}/> {t("coPilot")}</div></div>
          <div className="hero-orb orb-one"/><div className="hero-orb orb-two"/><div className="hero-spark spark-a">✦</div><div className="hero-spark spark-b">✧</div><div className="hero-spark spark-c">✦</div>
        </section>
        <section className="stat-grid">
          <div className="stat-card"><div className="stat-icon streak"><Flame size={18}/></div><div><strong>{stats.dayStreak} <small>{t("streak")}</small></strong><span>{t("keepSparkAlive")}</span></div></div>
          <div className="stat-card"><div className="stat-icon points"><Star size={18}/></div><div><strong>{stats.totalXp.toLocaleString()} <small>{t("points")}</small></strong><span>{t("curiosityAddsUp")}</span></div></div>
          <div className="stat-card"><div className="stat-icon answered"><Check size={18}/></div><div><strong>{stats.totalAnswered}</strong><span>{t("questions")}</span></div></div>
        </section>
        <section className="section-block"><div className="section-heading"><div><div className="eyebrow">{t("findNextSpark")}</div><h3>{t("categories")}</h3></div><button className="text-button" onClick={()=>setView("discover")}>{t("seeAll")} <ChevronRight size={15}/></button></div>
          <div className="category-grid">{availableCategories.length === 0 ? <div className="muted"><p>{t("questionBankEmptyForLocale", { locale: quizLanguage.toUpperCase() })}</p></div> : availableCategories.slice(0,4).map((c,i)=>{const Icon=iconMap[c.icon] ?? BrainCircuit;return <motion.button className={`category-card ${c.color}`} key={c.name} onClick={()=>startQuiz(c.name)} initial={{opacity:0,y:18,scale:.9}} animate={{opacity:1,y:0,scale:1}} whileHover={{y:-7,rotateX:4,scale:1.025}} whileTap={{scale:.94,rotateZ:-1.5}} transition={{type:"spring",stiffness:360,damping:18,delay:i*.055}}><span className="category-icon"><Icon size={22}/></span><b>{localizeCategory(c.name, i18n.language)}</b><small>{localizeCategoryDescription(c.name, i18n.language, c.desc)}</small><small>{t("stageNumber", { stage: categoryStages[c.name] ?? 1 })}</small><span className="category-arrow"><ChevronRight size={15}/></span><span className="category-sheen"/></motion.button>})}</div>
        </section>
        <section className="bottom-grid"><div className="panel leaderboard-preview"><div className="section-heading"><div><div className="eyebrow">{t("thisWeek")}</div><h3>{t("leaderboard")}</h3></div><button className="text-button" onClick={()=>setView("rankings")}>{t("seeAll")} <ChevronRight size={15}/></button></div>{leaderboardRows.slice(0,3).map(([rank,name,pts])=><div className="leader-row" key={rank}><span className={`rank rank-${rank}`}>{rank}</span><span className="leader-avatar">{name[0]}</span><b dir="auto">{name}</b><span className="leader-points">{pts} XP</span></div>)}</div>
          <div className="panel progress-panel"><div className="eyebrow">{t("yourJourney")}</div><h3>{t("yourProgress")}</h3><div className="progress-ring"><div><strong>{stats.totalAnswered ? Math.round(stats.totalCorrect / stats.totalAnswered * 100) : 0}%</strong><small>{t("accuracy")}</small></div></div><p className="muted">{stats.totalAnswered ? t("progressSummary", { correct: stats.totalCorrect, total: stats.totalAnswered }) : t("firstAnswerProgress")}</p></div></section>
      </motion.div>}

      {view==="quiz"&&<motion.div key="quiz" className="quiz-page" initial={{opacity:0,scale:.965,y:28,filter:"blur(8px)"}} animate={{opacity:1,scale:1,y:0,filter:"blur(0px)"}} exit={{opacity:0,scale:.985,y:-18,filter:"blur(6px)"}} transition={{type:"spring",stiffness:250,damping:25}}>
        <div className="quiz-top"><button className="back-button" onClick={()=>setView("home")}><ChevronLeft size={18}/>{t("back")}</button><span className="quiz-counter">{t("question")} {qIndex+1} {t("of")} {quizMeta?.questionCount ?? sessionQuestions.length}</span><button className="icon-button quiz-help" onClick={()=>setToast(remoteSessionId ? t("questionHelpServer") : t("questionHelpDemo"))}><CircleHelp size={18}/></button></div>
        <div className="quiz-stage-meta"><span>{t("stageNumber", { stage: quizMeta?.stage ?? 1 })}</span><span>{t("questionCount", { count: quizMeta?.questionCount ?? sessionQuestions.length })}</span><span>{quizMeta?.difficulty === "demo" ? t("demoMode") : localizeDifficulty((quizMeta?.difficulty ?? current.difficulty) as Question["difficulty"], i18n.language)}</span></div><div className="progress-track"><motion.div className="progress-fill" animate={{width:`${progress}%`}}/></div>
        <AnimatePresence mode="wait"><motion.div key={current.id} className="quiz-card" initial={{opacity:0,x:36,scale:.97,filter:"blur(6px)"}} animate={{opacity:1,x:0,scale:1,filter:"blur(0px)"}} exit={{opacity:0,x:-28,scale:.98,filter:"blur(5px)"}} transition={{type:"spring",stiffness:260,damping:24}}><div className="quiz-mascot-chip"><img src="/assets/pi-brain-robot.png" alt=""/><span>{t("readyWhen")}</span><Sparkles size={13}/></div><div className="quiz-tags"><span className="tag">{localizeCategory(current.category, i18n.language)}</span><span className="tag subtle">{localizeDifficulty(current.difficulty, i18n.language)}</span></div><div className="question-number">0{qIndex+1}</div><h2 dir="auto">{current.prompt}</h2><p className="muted">{t("choose")}</p>
          <div className="answer-list">{current.options.map((option,i)=>{const correctIndex = remoteSessionId ? (remoteFeedback?.questionId===current.id ? remoteFeedback.answerIndex : -1) : current.answer; return <motion.button key={option} onClick={()=>chooseAnswer(i)} disabled={checked || answerSubmitting} className={`answer-option ${selected===i?"chosen":""} ${checked&&i===correctIndex?"right":""} ${checked&&selected===i&&i!==correctIndex?"wrong":""}`} whileTap={{scale:.975,x:3}} animate={{scale:selected===i?1.015:1}} transition={{type:"spring",stiffness:440,damping:23}}><span className="answer-letter" dir="ltr">{String.fromCharCode(65+i)}</span><span dir="auto">{option}</span>{checked&&i===correctIndex&&<Check size={18}/>}</motion.button>})}</div>
          <AnimatePresence>{checked&&<motion.div className={`feedback ${(remoteFeedback?.questionId===current.id ? remoteFeedback.correct : selected===current.answer)?"success":"try-again"}`} initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}}><b>{(remoteFeedback?.questionId===current.id ? remoteFeedback.correct : selected===current.answer)?t("correct"):t("incorrect")}</b>{(remoteFeedback?.questionId===current.id ? remoteFeedback.correct : selected===current.answer)&&<div className="mini-celebration">✦ +15 XP <Sparkles size={13}/> {t("niceWork")}</div>}<p dir="auto">{remoteSessionId ? remoteFeedback?.explanation : current.explanation}</p><span className="feedback-label"><Lightbulb size={14}/>{t("explanation")}</span></motion.div>}</AnimatePresence>
          {!checked?<motion.button className="primary-button full" disabled={selected===null || answerSubmitting} onClick={checkAnswer} whileHover={{scale:1.015,y:-2}} whileTap={{scale:.96,y:2}} transition={{type:"spring",stiffness:420,damping:18}}>{answerSubmitting?t("savingAnswer"):t("check")}<ChevronRight size={17}/></motion.button>:<motion.button className="primary-button full" onClick={nextQuestion} disabled={questionLoading} whileHover={{scale:1.015,y:-2}} whileTap={{scale:.96,y:2}} transition={{type:"spring",stiffness:420,damping:18}}>{questionLoading ? t("loadingQuestion") : qIndex===(quizMeta?.questionCount ?? sessionQuestions.length)-1?t("finish"):t("next")}<ChevronRight size={17}/></motion.button>}
        </motion.div></AnimatePresence>
      </motion.div>}

      {view==="result"&&<motion.div key="result" className="result-page" initial={{opacity:0,scale:.82,y:24,rotateX:8}} animate={{opacity:1,scale:1,y:0,rotateX:0}} transition={{type:"spring",stiffness:220,damping:18}} exit={{opacity:0,scale:.92,y:-18,filter:"blur(6px)"}}><div className="result-mascot"><img src="/assets/pi-brain-robot.png" alt={t("mascotCelebrating")}/><div className="result-glow"><Award size={38}/></div></div><div className="eyebrow">{t("dailyChallengeComplete")}</div><h1>{t("resultHeadline")}</h1><p className="muted">{t("resultDescription")}</p><div className="result-score"><strong>{score}</strong><span>{t("scoreOfQuestions", { score, total: quizMeta?.questionCount ?? sessionQuestions.length })}</span></div><div className="result-stats"><div><Star/><b>{score*15} XP</b><small>{t("earnedToday")}</small></div><div><Activity/><b>{Math.round(score/Math.max(quizMeta?.questionCount ?? sessionQuestions.length,1)*100)}%</b><small>{t("accuracy")}</small></div><div><Flame/><b>{t("oneDay")}</b><small>{t("streakProgress")}</small></div></div><motion.button className="primary-button" onClick={()=>{if (!piAccessToken) {setToast(t("signInForLeaderboard")); return;} if (!availableCategories.length) {setToast(t("questionBankEmpty")); return;} void startQuiz();}} whileHover={{scale:1.035,y:-3}} whileTap={{scale:.94,y:2}}>{t("playAgain")}<ChevronRight size={17}/></motion.button><button className="text-button centered" onClick={()=>setView("home")}>{t("back")}</button></motion.div>}

      {view==="discover"&&<motion.div key="discover" className="page" initial={{opacity:0,scale:.97,y:26,filter:"blur(7px)"}} animate={{opacity:1,scale:1,y:0,filter:"blur(0px)"}} transition={{type:"spring",stiffness:240,damping:24}} exit={{opacity:0,scale:.97,y:-18,filter:"blur(5px)"}}><div className="eyebrow">{t("worldOfIdeas")}</div><h1>{t("categories")}</h1><p className="muted">{t("discoverLead")}</p><div className="category-grid discover-grid">{availableCategories.length === 0 && <div className="muted"><p>{t("questionBankEmptyForLocale", { locale: quizLanguage.toUpperCase() })}</p></div>}<motion.button className="category-card violet" onClick={()=>{if (availableCategories.length) void startQuiz(); else setToast(t("questionBankEmpty"));}} disabled={availableCategories.length===0} whileHover={{y:-7,scale:1.025}} whileTap={{scale:.94}}><span className="category-icon"><Shuffle size={22}/></span><b>{t("randomQuestions")}</b><small>{t("approvedCategories")}</small><small>{t("stageNumber", { stage: randomStage })}</small><span className="category-arrow"><ChevronRight size={15}/></span></motion.button>{availableCategories.map((c,i)=>{const Icon=iconMap[c.icon] ?? BrainCircuit;return <motion.button className={`category-card ${c.color}`} key={c.name} onClick={()=>startQuiz(c.name)} initial={{opacity:0,y:18,scale:.9}} animate={{opacity:1,y:0,scale:1}} whileHover={{y:-7,rotateX:4,scale:1.025}} whileTap={{scale:.94,rotateZ:-1.5}} transition={{type:"spring",stiffness:360,damping:18}}><span className="category-icon"><Icon size={22}/></span><b>{localizeCategory(c.name, i18n.language)}</b><small>{localizeCategoryDescription(c.name, i18n.language, c.desc)}</small><small>{t("stageNumber", { stage: categoryStages[c.name] ?? 1 })}</small><span className="category-arrow"><ChevronRight size={15}/></span><span className="category-sheen"/></motion.button>})}</div></motion.div>}

      {view==="rankings"&&<motion.div key="rankings" className="page" initial={{opacity:0,scale:.97,y:26,filter:"blur(7px)"}} animate={{opacity:1,scale:1,y:0,filter:"blur(0px)"}} transition={{type:"spring",stiffness:240,damping:24}} exit={{opacity:0,scale:.97,y:-18,filter:"blur(5px)"}}><div className="eyebrow">{t("globalCommunity")}</div><h1>{t("leaderboard")}</h1><p className="muted">{t("communityLead")}</p><div className="panel ranking-panel">{leaderboardRows.length ? leaderboardRows.map(([rank,name,pts])=><div className="leader-row" key={rank}><span className={`rank rank-${rank}`}>{rank}</span><span className="leader-avatar">{name[0]}</span><b dir="auto">{name}</b><span className="leader-points">{pts} XP</span></div>) : <p className="muted">{t("noScores")}</p>}</div><p className="demo-note"><LockKeyhole size={14}/> {piProfile ? t("liveLeaderboard") : `${t("previewOnly")} — ${t("signInForLeaderboard")} `}</p></motion.div>}

      {view==="profile"&&<motion.div key="profile" className="page" initial={{opacity:0,scale:.97,y:26,filter:"blur(7px)"}} animate={{opacity:1,scale:1,y:0,filter:"blur(0px)"}} transition={{type:"spring",stiffness:240,damping:24}} exit={{opacity:0,scale:.97,y:-18,filter:"blur(5px)"}}><div className="eyebrow">{t("yourSpace")}</div><h1>{t("profile")}</h1><div className="panel profile-panel"><div className="profile-avatar">{piProfile?.username?.charAt(0)?.toUpperCase() || "G"}</div><h2 dir="auto">{piProfile?.username || t("guestExplorer")}</h2><span className="muted">{piProfile ? t("piIdentityVerified") : t("connectPiIdentity")}</span>{piProfile&&<div className="pi-verified-pill"><CheckCircle2 size={14}/> {t("verifiedWithPi")}</div>}<div className="profile-metrics"><div><b>{(piProfile?.total_xp ?? stats.totalXp).toLocaleString()}</b><small>XP</small></div><div><b>{piProfile?.day_streak ?? stats.dayStreak}</b><small>{t("dayStreakLabel")}</small></div><div><b>{piProfile?.total_answered ?? stats.totalAnswered}</b><small>{t("answeredLabel")}</small></div></div>{!piProfile?<><motion.button className="primary-button pi-connect-button" onClick={() => signInWithPi()} disabled={piAuthBusy} whileTap={{scale:.97}}>{piAuthBusy?t("connecting"):t("signInWithPi")}<ChevronRight size={17}/></motion.button><div className="demo-note"><LockKeyhole size={14}/> {isBackendConfigured()?t("openPiBrowser"):t("backendSetup")}</div></>:<><div className="demo-note"><CheckCircle2 size={14}/> {t("piUidSaved")}</div><button className="text-button centered" onClick={() => signOutPi()}>{t("signOutSession")}</button></>}{piAuthMessage&&<p className="auth-message" role="status">{piAuthMessage}</p>}</div></motion.div>}
      </AnimatePresence>
    </main>

    <footer className="bottom-nav">{navItems.map(n=><motion.button key={n.id} className={view===n.id?"bottom-nav-item active":"bottom-nav-item"} onClick={()=>setView(n.id)} whileTap={{scale:.86,y:-3}}><n.icon size={19}/><span>{n.label}</span></motion.button>)}</footer>
    <AnimatePresence>{toast&&<motion.div className="toast" initial={{opacity:0,y:15}} animate={{opacity:1,y:0}} exit={{opacity:0,y:10}}>{toast}<button onClick={()=>setToast("")}><X size={14}/></button></motion.div>}</AnimatePresence>
  </div></MotionConfig>;
}
function ClockIcon(){return <Activity size={14}/>;}
