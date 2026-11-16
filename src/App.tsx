import { useState, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Activity, Atom, Award, BrainCircuit, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Cpu, Flame, Globe2, Home, Languages, Leaf, Lightbulb, LockKeyhole, Menu, Palette, Play, Sparkles, Star, Trophy, UserRound, X, Orbit, Shapes, Volume2, VolumeX, Sun, CheckCircle2, Shuffle } from "lucide-react";
import { applyLocale } from "./i18n/config";
import { categories, questions, type Question } from "./data";
import { playUiSound, startAmbientMusic, stopAmbientMusic } from "./audio";
import { authenticatePiUser } from "./services/pi";
import { fetchLeaderboard, fetchNextServerQuestion, fetchQuizCatalog, isBackendConfigured, startServerQuiz, submitServerAnswer, type LeaderboardEntry, type PiVerifiedProfile, type ServerQuestion } from "./services/backend";

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
const languageOptions = [
  ["en","English"],["fa","فارسی"],["ar","العربية"],["es","Español"],["fr","Français"],
  ["de","Deutsch"],["pt","Português"],["hi","हिन्दी"],["zh","中文"],["ja","日本語"],["ru","Русский"]
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

export default function App() {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<"home"|"quiz"|"result"|"rankings"|"discover"|"profile">("home");
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>(questions);
  const [availableCategories, setAvailableCategories] = useState(categories);
  const [categoryStages, setCategoryStages] = useState<Record<string, number>>({});
  const [randomStage, setRandomStage] = useState(1);
  const [quizMeta, setQuizMeta] = useState<{ pathKey: string; stage: number; questionCount: number; difficulty: string } | null>(null);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<number|null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("pi-brain-theme");
      return themes.some(item => item.id === saved) ? saved! : "cosmic";
    } catch {
      return "cosmic";
    }
  });
  const [mobileMenu, setMobileMenu] = useState(false);
  const [toast, setToast] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const [stats, setStats] = useState<LocalStats>(readLocalStats);
  const [piProfile, setPiProfile] = useState<PiVerifiedProfile | null>(null);
  const [piAccessToken, setPiAccessToken] = useState<string | null>(null);
  const [piAuthBusy, setPiAuthBusy] = useState(false);
  const [piAuthMessage, setPiAuthMessage] = useState("");
  const [remoteSessionId, setRemoteSessionId] = useState<string | null>(null);
  const [remoteFeedback, setRemoteFeedback] = useState<{ questionId: string; correct: boolean; answerIndex: number; explanation: string } | null>(null);
  const [answerSubmitting, setAnswerSubmitting] = useState(false);
  const [liveLeaderboard, setLiveLeaderboard] = useState<LeaderboardEntry[]>([]);
  const current = sessionQuestions[qIndex] ?? sessionQuestions[0] ?? questions[0];
  const progress = ((qIndex + (checked ? 1 : 0)) / Math.max(quizMeta?.questionCount ?? sessionQuestions.length, 1)) * 100;
  const navItems = [
    {id:"home",label:t("home"),icon:Home},{id:"discover",label:t("discover"),icon:Sparkles},
    {id:"rankings",label:t("rankings"),icon:Trophy},{id:"profile",label:t("profile"),icon:UserRound}
  ] as const;
  const leaderboardRows = piProfile
    ? liveLeaderboard.map((entry) => [String(entry.rank), entry.username, entry.total_xp.toLocaleString()])
    : [["1","NovaMind","2,840"],["2","CuriousCat","2,610"],["3","You","2,420"],["4","OrbitFox","2,180"],["5","BlueComet","1,940"]];

  const changeLanguage = (code:string) => {
    applyLocale(code);
    setLanguageOpen(false);
    if (piAccessToken) {
      void fetchQuizCatalog(piAccessToken, code).then((catalog) => {
        const metadata = new Map(categories.map((item) => [item.name, item]));
        setAvailableCategories(catalog.categories.map((name, index) => metadata.get(name) ?? ({
          name, icon: "BrainCircuit",
          color: ["violet", "blue", "cyan", "green", "pink", "amber", "indigo", "rose"][index % 8],
          desc: "Explore approved questions in this topic",
        })));
        setCategoryStages(catalog.progress ?? {});
        setRandomStage(catalog.progress?.__random__ ?? 1);
      }).catch((error) => setToast(error instanceof Error ? error.message : "Could not refresh quiz categories."));
    }
  };
  const signInWithPi = async () => {
    if (!isBackendConfigured()) {
      setPiAuthMessage("برای ورود واقعی، ابتدا آدرس پروژه و کلید عمومی Supabase را در فایل .env.local قرار بده.");
      return;
    }
    setPiAuthBusy(true);
    setPiAuthMessage("");
    try {
      const result = await authenticatePiUser(i18n.language);
      setPiProfile(result.profile);
      // Kept in memory only. The Pi access token is deliberately not written to localStorage.
      setPiAccessToken(result.accessToken);
      try {
        const catalog = await fetchQuizCatalog(result.accessToken, i18n.language);
        const metadata = new Map(categories.map((item) => [item.name, item]));
        setAvailableCategories(catalog.categories.map((name, index) => metadata.get(name) ?? ({
          name,
          icon: "BrainCircuit",
          color: ["violet", "blue", "cyan", "green", "pink", "amber", "indigo", "rose"][index % 8],
          desc: "Explore approved questions in this topic",
        })));
        setCategoryStages(catalog.progress ?? {});
        setRandomStage(catalog.progress?.__random__ ?? 1);
      } catch (catalogError) {
        setToast(catalogError instanceof Error ? catalogError.message : "Could not load quiz categories.");
        setAvailableCategories(categories);
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
      setPiAuthMessage("هویت شما با موفقیت از طریق Pi Network تأیید شد.");
      if (soundOn) playUiSound("success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "ورود با Pi انجام نشد.";
      setPiAuthMessage(message);
      setToast(message);
    } finally {
      setPiAuthBusy(false);
    }
  };
  const signOutPi = () => {
    setPiProfile(null);
    setPiAccessToken(null);
    setAvailableCategories(categories);
    setCategoryStages({});
    setRandomStage(1);
    setRemoteSessionId(null);
    setRemoteFeedback(null);
    setLiveLeaderboard([]);
    setPiAuthMessage("از حساب Pi خارج شدی. برای ورود دوباره، اتصال Pi را انتخاب کن.");
    setStats(readLocalStats());
  };
  const changeTheme = (id:string) => {
    setTheme(id);
    try { localStorage.setItem("pi-brain-theme", id); } catch { /* Theme still applies for this session. */ }
    setThemeOpen(false);
    if (soundOn) playUiSound("select");
  };
  const toggleSound = () => { const next = !soundOn; setSoundOn(next); if (next) startAmbientMusic(); else stopAmbientMusic(); };
  const startQuiz = async (category?:string) => {
    const pathKey = category || "__random__";
    if (piAccessToken) {
      try {
        const remote = await startServerQuiz(piAccessToken, pathKey, i18n.language);
        const firstQuestion = remote.questions[0];
        if (!firstQuestion) throw new Error("The server did not deliver the first question.");
        setSessionQuestions([mapServerQuestion(firstQuestion)]);
        setRemoteSessionId(remote.session_id);
        setQuizMeta({
          pathKey: remote.path_key,
          stage: remote.stage,
          questionCount: remote.question_count,
          difficulty: remote.difficulty.replace(/_/g, " "),
        });
        setRemoteFeedback(null);
        setQIndex(0);
        setSelected(null);
        setChecked(false);
        setScore(0);
        setView("quiz");
        return;
      } catch (error) {
        // A Pi-authenticated user must never silently fall back to local demo data.
        const message = error instanceof Error ? error.message : "The server quiz could not be started.";
        setToast(message);
        return;
      }
    }

    const list = pathKey !== "__random__"
      ? questions.filter((q) => q.category === pathKey)
      : [...questions].sort(() => Math.random() - 0.5);
    if (!list.length) { setToast("More original questions are being prepared for this topic."); return; }
    setSessionQuestions(list);
    setRemoteSessionId(null);
    setQuizMeta({ pathKey, stage: 1, questionCount: list.length, difficulty: "demo" });
    setRemoteFeedback(null);
    setQIndex(0);
    setSelected(null);
    setChecked(false);
    setScore(0);
    setView("quiz");
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
        const message = error instanceof Error ? error.message : "Answer could not be saved.";
        setToast(message);
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
        const message = error instanceof Error ? error.message : "The next question could not be loaded.";
        setToast(message);
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

  return <div className="app-shell" data-theme={theme} onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => { const target = event.target as HTMLElement; if (soundOn && target.closest("button")) { startAmbientMusic(); playUiSound("tap"); } }}>
    <header className="topbar">
      <button className="brand" onClick={()=>setView("home")} aria-label="Pi Brain home">
        <span className="brand-mark"><Orbit size={22}/></span><span>pi<span className="brand-accent">brain</span></span><span className="brand-beta">COSMIC QUIZ</span>
      </button>
      <nav className="desktop-nav">{navItems.map(n=><motion.button key={n.id} className={view===n.id?"nav-link active":"nav-link"} onClick={()=>setView(n.id)} whileTap={{scale:.9}} transition={{type:"spring",stiffness:500,damping:20}}><n.icon size={17}/>{n.label}</motion.button>)}</nav>
      <div className="top-actions">
        <div className="theme-wrap">
          <motion.button className="icon-button theme-button" onClick={()=>{setThemeOpen(v=>!v);setLanguageOpen(false)}} whileTap={{scale:.86,rotate:18}} aria-label={i18n.language === "fa" ? "انتخاب تم رنگی" : "Choose color theme"} aria-expanded={themeOpen} title={i18n.language === "fa" ? "انتخاب تم" : "Choose theme"}><Palette size={17}/><span>{i18n.language === "fa" ? "تم‌ها" : "THEMES"}</span></motion.button>
          <AnimatePresence>{themeOpen&&<motion.div className="theme-menu" initial={{opacity:0,y:12,scale:.94,filter:"blur(5px)"}} animate={{opacity:1,y:0,scale:1,filter:"blur(0px)"}} exit={{opacity:0,y:8,scale:.96}} transition={{type:"spring",stiffness:420,damping:25}}><div className="theme-menu-head"><div><b>{i18n.language === "fa" ? "جهان رنگی خودت را انتخاب کن" : "Choose your universe"}</b><small>{i18n.language === "fa" ? "ظاهر Pi Brain را شخصی‌سازی کن" : "Make Pi Brain yours"}</small></div><button className="theme-close" onClick={()=>setThemeOpen(false)} aria-label="Close themes"><X size={15}/></button></div><div className="theme-options">{themes.map((item,i)=><motion.button key={item.id} className={`theme-option ${theme===item.id?"active":""}`} onClick={()=>changeTheme(item.id)} whileHover={{x:4,scale:1.015}} whileTap={{scale:.96}} initial={{opacity:0,x:10}} animate={{opacity:1,x:0}} transition={{delay:i*.035}}><span className="theme-swatches">{item.colors.map((color,j)=><i key={j} style={{background:color}}/>)}</span><span className="theme-name"><b>{i18n.language==="fa"?item.fa:item.name}</b><small>{item.mode==="light"?"Light mode":"Dark mode"}</small></span>{theme===item.id&&<CheckCircle2 size={17}/>}</motion.button>)}</div><div className="theme-tip"><Sun size={13}/> {i18n.language === "fa" ? "تم روشن برای محیط‌های پرنور طراحی شده است" : "Light theme is designed for bright environments"}</div></motion.div>}</AnimatePresence>
        </div>
        <button className={`icon-button sound-button ${soundOn ? "sound-on" : ""}`} onClick={toggleSound} aria-label={soundOn ? "Mute music and sound effects" : "Enable music and sound effects"} title={soundOn ? "Sound on" : "Sound off"}>{soundOn ? <Volume2 size={17}/> : <VolumeX size={17}/>}<span>{soundOn ? "SOUND ON" : "SOUND OFF"}</span></button>
        <div className="language-wrap">
          <button className="icon-button language-button" onClick={()=>setLanguageOpen(v=>!v)}><Languages size={17}/><span>{i18n.language.toUpperCase()}</span><ChevronDown size={14}/></button>
          <AnimatePresence>{languageOpen&&<motion.div className="language-menu" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:8}}>{languageOptions.map(([code,label])=><button key={code} onClick={()=>changeLanguage(code)} className={i18n.language===code?"selected":""}>{label}{i18n.language===code&&<Check size={14}/>}</button>)}</motion.div>}</AnimatePresence>
        </div>
        <button className="avatar" onClick={()=>setView("profile")} aria-label="Open profile">{piProfile?.username?.charAt(0)?.toUpperCase() || "G"}</button>
        <button className="mobile-menu-button" onClick={()=>setMobileMenu(v=>!v)}><Menu/></button>
      </div>
    </header>

    {mobileMenu&&<div className="mobile-menu">{navItems.map(n=><button key={n.id} onClick={()=>{setView(n.id);setMobileMenu(false)}}><n.icon size={17}/>{n.label}</button>)}</div>}

    <main className="main-content">
      <AnimatePresence mode="wait">
      {view==="home"&&<motion.div key="home" className="page" initial={{opacity:0,scale:.965,y:28,filter:"blur(8px)"}} animate={{opacity:1,scale:1,y:0,filter:"blur(0px)"}} exit={{opacity:0,scale:.985,y:-18,filter:"blur(6px)"}} transition={{type:"spring",stiffness:250,damping:25}}>
        <div className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/>{t("welcome")}</div><h1>{t("greeting")}</h1><p className="muted">{t("subtitle")}</p></div><div className="level-pill"><Sparkles size={15}/>{t("level")}</div></div>
        <section className="hero-card">
          <div className="hero-copy"><div className="hero-kicker"><span className="sun-dot"/> {t("daily")} <span className="hero-live">LIVE QUEST</span></div><h2>Ready to explore<br/><span>the impossible?</span></h2><p>Your curious co-pilot is ready. Jump into a universe of surprising questions, wild facts and brilliant discoveries.</p><motion.button className="primary-button hero-cta" onClick={()=>startQuiz()} whileHover={{scale:1.035,y:-3}} whileTap={{scale:.94,y:2}} transition={{type:"spring",stiffness:420,damping:17}}><span className="cta-icon"><Play size={16} fill="currentColor"/></span>{t("start")}<ChevronRight size={17}/><span className="button-shine"/></motion.button><div className="hero-meta"><span><ClockIcon/> 5 min</span><span><CircleHelp size={14}/> Stage-based quiz</span><span><Star size={14}/> +120 XP</span></div></div>
          <div className="hero-art"><div className="robot-aura"/><img src="/assets/pi-brain-robot.png" alt="Pi Brain friendly space robot mascot waving and holding a glowing star"/><div className="robot-orbit orbit-a"/><div className="robot-orbit orbit-b"/><div className="mascot-tag"><Sparkles size={14}/> YOUR COSMIC CO-PILOT</div></div>
          <div className="hero-orb orb-one"/><div className="hero-orb orb-two"/><div className="hero-spark spark-a">✦</div><div className="hero-spark spark-b">✧</div><div className="hero-spark spark-c">✦</div>
        </section>
        <section className="stat-grid">
          <div className="stat-card"><div className="stat-icon streak"><Flame size={18}/></div><div><strong>{stats.dayStreak} <small>{t("streak")}</small></strong><span>Keep your spark alive</span></div></div>
          <div className="stat-card"><div className="stat-icon points"><Star size={18}/></div><div><strong>{stats.totalXp.toLocaleString()} <small>{t("points")}</small></strong><span>Your curiosity adds up</span></div></div>
          <div className="stat-card"><div className="stat-icon answered"><Check size={18}/></div><div><strong>{stats.totalAnswered}</strong><span>{t("questions")}</span></div></div>
        </section>
        <section className="section-block"><div className="section-heading"><div><div className="eyebrow">FIND YOUR NEXT SPARK</div><h3>{t("categories")}</h3></div><button className="text-button" onClick={()=>setView("discover")}>{t("seeAll")} <ChevronRight size={15}/></button></div>
          <div className="category-grid">{availableCategories.slice(0,4).map((c,i)=>{const Icon=iconMap[c.icon] ?? BrainCircuit;return <motion.button className={`category-card ${c.color}`} key={c.name} onClick={()=>startQuiz(c.name)} initial={{opacity:0,y:18,scale:.9}} animate={{opacity:1,y:0,scale:1}} whileHover={{y:-7,rotateX:4,scale:1.025}} whileTap={{scale:.94,rotateZ:-1.5}} transition={{type:"spring",stiffness:360,damping:18,delay:i*.055}}><span className="category-icon"><Icon size={22}/></span><b>{c.name}</b><small>{c.desc}</small><small>Stage {categoryStages[c.name] ?? 1}</small><span className="category-arrow"><ChevronRight size={15}/></span><span className="category-sheen"/></motion.button>})}</div>
        </section>
        <section className="bottom-grid"><div className="panel leaderboard-preview"><div className="section-heading"><div><div className="eyebrow">THIS WEEK</div><h3>{t("leaderboard")}</h3></div><button className="text-button" onClick={()=>setView("rankings")}>{t("seeAll")} <ChevronRight size={15}/></button></div>{leaderboardRows.slice(0,3).map(([rank,name,pts])=><div className="leader-row" key={rank}><span className={`rank rank-${rank}`}>{rank}</span><span className="leader-avatar">{name[0]}</span><b>{name}</b><span className="leader-points">{pts} XP</span></div>)}</div>
          <div className="panel progress-panel"><div className="eyebrow">YOUR JOURNEY</div><h3>{t("yourProgress")}</h3><div className="progress-ring"><div><strong>{stats.totalAnswered ? Math.round(stats.totalCorrect / stats.totalAnswered * 100) : 0}%</strong><small>Accuracy</small></div></div><p className="muted">{stats.totalAnswered ? `${stats.totalCorrect} correct answers out of ${stats.totalAnswered}. Keep exploring!` : "Your first answered question will start your progress journey."}</p></div></section>
      </motion.div>}

      {view==="quiz"&&<motion.div key="quiz" className="quiz-page" initial={{opacity:0,scale:.965,y:28,filter:"blur(8px)"}} animate={{opacity:1,scale:1,y:0,filter:"blur(0px)"}} exit={{opacity:0,scale:.985,y:-18,filter:"blur(6px)"}} transition={{type:"spring",stiffness:250,damping:25}}>
        <div className="quiz-top"><button className="back-button" onClick={()=>setView("home")}><ChevronLeft size={18}/>{t("back")}</button><span className="quiz-counter">{t("question")} {qIndex+1} {t("of")} {quizMeta?.questionCount ?? sessionQuestions.length}</span><button className="icon-button quiz-help" onClick={()=>setToast(remoteSessionId ? "Your current stage advances only after every question is answered." : "Your progress is saved in this demo session.")}><CircleHelp size={18}/></button></div>
        <div className="quiz-stage-meta"><span>Stage {quizMeta?.stage ?? 1}</span><span>{quizMeta?.questionCount ?? sessionQuestions.length} questions</span><span>{quizMeta?.difficulty ?? current.difficulty}</span></div><div className="progress-track"><motion.div className="progress-fill" animate={{width:`${progress}%`}}/></div>
        <AnimatePresence mode="wait"><motion.div key={current.id} className="quiz-card" initial={{opacity:0,x:36,scale:.97,filter:"blur(6px)"}} animate={{opacity:1,x:0,scale:1,filter:"blur(0px)"}} exit={{opacity:0,x:-28,scale:.98,filter:"blur(5px)"}} transition={{type:"spring",stiffness:260,damping:24}}><div className="quiz-mascot-chip"><img src="/assets/pi-brain-robot.png" alt=""/><span>Ready when you are!</span><Sparkles size={13}/></div><div className="quiz-tags"><span className="tag">{current.category}</span><span className="tag subtle">{current.difficulty}</span></div><div className="question-number">0{qIndex+1}</div><h2>{current.prompt}</h2><p className="muted">{t("choose")}</p>
          <div className="answer-list">{current.options.map((option,i)=>{const correctIndex = remoteSessionId ? (remoteFeedback?.questionId===current.id ? remoteFeedback.answerIndex : -1) : current.answer; return <motion.button key={option} onClick={()=>chooseAnswer(i)} disabled={checked || answerSubmitting} className={`answer-option ${selected===i?"chosen":""} ${checked&&i===correctIndex?"right":""} ${checked&&selected===i&&i!==correctIndex?"wrong":""}`} whileTap={{scale:.975,x:3}} animate={{scale:selected===i?1.015:1}} transition={{type:"spring",stiffness:440,damping:23}}><span className="answer-letter">{String.fromCharCode(65+i)}</span><span>{option}</span>{checked&&i===correctIndex&&<Check size={18}/>}</motion.button>})}</div>
          <AnimatePresence>{checked&&<motion.div className={`feedback ${(remoteFeedback?.questionId===current.id ? remoteFeedback.correct : selected===current.answer)?"success":"try-again"}`} initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}}><b>{(remoteFeedback?.questionId===current.id ? remoteFeedback.correct : selected===current.answer)?t("correct"):t("incorrect")}</b>{(remoteFeedback?.questionId===current.id ? remoteFeedback.correct : selected===current.answer)&&<div className="mini-celebration">✦ +15 XP <Sparkles size={13}/> NICE WORK!</div>}<p>{remoteSessionId ? remoteFeedback?.explanation : current.explanation}</p><span className="feedback-label"><Lightbulb size={14}/>{t("explanation")}</span></motion.div>}</AnimatePresence>
          {!checked?<motion.button className="primary-button full" disabled={selected===null || answerSubmitting} onClick={checkAnswer} whileHover={{scale:1.015,y:-2}} whileTap={{scale:.96,y:2}} transition={{type:"spring",stiffness:420,damping:18}}>{answerSubmitting?"Saving answer…":t("check")}<ChevronRight size={17}/></motion.button>:<motion.button className="primary-button full" onClick={nextQuestion} disabled={questionLoading} whileHover={{scale:1.015,y:-2}} whileTap={{scale:.96,y:2}} transition={{type:"spring",stiffness:420,damping:18}}>{questionLoading ? "Loading question…" : qIndex===(quizMeta?.questionCount ?? sessionQuestions.length)-1?t("finish"):t("next")}<ChevronRight size={17}/></motion.button>}
        </motion.div></AnimatePresence>
      </motion.div>}

      {view==="result"&&<motion.div key="result" className="result-page" initial={{opacity:0,scale:.82,y:24,rotateX:8}} animate={{opacity:1,scale:1,y:0,rotateX:0}} transition={{type:"spring",stiffness:220,damping:18}} exit={{opacity:0,scale:.92,y:-18,filter:"blur(6px)"}}><div className="result-mascot"><img src="/assets/pi-brain-robot.png" alt="Pi Brain robot celebrating"/><div className="result-glow"><Award size={38}/></div></div><div className="eyebrow">DAILY CHALLENGE COMPLETE</div><h1>Curiosity looks good on you.</h1><p className="muted">You made time to discover something new. That's a win.</p><div className="result-score"><strong>{score}</strong><span>/ {sessionQuestions.length} correct</span></div><div className="result-stats"><div><Star/><b>{score*15} XP</b><small>Earned today</small></div><div><Activity/><b>{Math.round(score/Math.max(sessionQuestions.length,1)*100)}%</b><small>Accuracy</small></div><div><Flame/><b>+1 day</b><small>Streak progress</small></div></div><motion.button className="primary-button" onClick={()=>startQuiz()} whileHover={{scale:1.035,y:-3}} whileTap={{scale:.94,y:2}}>{t("playAgain")}<ChevronRight size={17}/></motion.button><button className="text-button centered" onClick={()=>setView("home")}>{t("back")}</button></motion.div>}

      {view==="discover"&&<motion.div key="discover" className="page" initial={{opacity:0,scale:.97,y:26,filter:"blur(7px)"}} animate={{opacity:1,scale:1,y:0,filter:"blur(0px)"}} transition={{type:"spring",stiffness:240,damping:24}} exit={{opacity:0,scale:.97,y:-18,filter:"blur(5px)"}}><div className="eyebrow">A WORLD OF IDEAS</div><h1>{t("categories")}</h1><p className="muted">Follow a question. Find a new interest. Keep exploring.</p><div className="category-grid discover-grid"><motion.button className="category-card violet" onClick={()=>startQuiz()} whileHover={{y:-7,scale:1.025}} whileTap={{scale:.94}}><span className="category-icon"><Shuffle size={22}/></span><b>Random Questions</b><small>All approved categories</small><small>Stage {randomStage}</small><span className="category-arrow"><ChevronRight size={15}/></span></motion.button>{availableCategories.map((c,i)=>{const Icon=iconMap[c.icon] ?? BrainCircuit;return <motion.button className={`category-card ${c.color}`} key={c.name} onClick={()=>startQuiz(c.name)} initial={{opacity:0,y:18,scale:.9}} animate={{opacity:1,y:0,scale:1}} whileHover={{y:-7,rotateX:4,scale:1.025}} whileTap={{scale:.94,rotateZ:-1.5}} transition={{type:"spring",stiffness:360,damping:18}}><span className="category-icon"><Icon size={22}/></span><b>{c.name}</b><small>{c.desc}</small><small>Stage {categoryStages[c.name] ?? 1}</small><span className="category-arrow"><ChevronRight size={15}/></span><span className="category-sheen"/></motion.button>})}</div></motion.div>}

      {view==="rankings"&&<motion.div key="rankings" className="page" initial={{opacity:0,scale:.97,y:26,filter:"blur(7px)"}} animate={{opacity:1,scale:1,y:0,filter:"blur(0px)"}} transition={{type:"spring",stiffness:240,damping:24}} exit={{opacity:0,scale:.97,y:-18,filter:"blur(5px)"}}><div className="eyebrow">THE GLOBAL COMMUNITY</div><h1>{t("leaderboard")}</h1><p className="muted">A friendly celebration of daily curiosity.</p><div className="panel ranking-panel">{leaderboardRows.length ? leaderboardRows.map(([rank,name,pts])=><div className="leader-row" key={rank}><span className={`rank rank-${rank}`}>{rank}</span><span className="leader-avatar">{name[0]}</span><b>{name}</b><span className="leader-points">{pts} XP</span></div>) : <p className="muted">No Pioneer scores have been recorded yet. Complete a server quiz to appear here.</p>}</div><p className="demo-note"><LockKeyhole size={14}/> {piProfile ? "Live Supabase leaderboard for verified Pi users." : "Preview data only — sign in with Pi to load the live global leaderboard."}</p></motion.div>}

      {view==="profile"&&<motion.div key="profile" className="page" initial={{opacity:0,scale:.97,y:26,filter:"blur(7px)"}} animate={{opacity:1,scale:1,y:0,filter:"blur(0px)"}} transition={{type:"spring",stiffness:240,damping:24}} exit={{opacity:0,scale:.97,y:-18,filter:"blur(5px)"}}><div className="eyebrow">YOUR SPACE</div><h1>{t("profile")}</h1><div className="panel profile-panel"><div className="profile-avatar">{piProfile?.username?.charAt(0)?.toUpperCase() || "G"}</div><h2>{piProfile?.username || "Guest Explorer"}</h2><span className="muted">{piProfile ? "Pi Network identity verified" : "Connect your Pi identity to create your global Pioneer profile."}</span>{piProfile&&<div className="pi-verified-pill"><CheckCircle2 size={14}/> VERIFIED WITH PI NETWORK</div>}<div className="profile-metrics"><div><b>{(piProfile?.total_xp ?? stats.totalXp).toLocaleString()}</b><small>XP</small></div><div><b>{piProfile?.day_streak ?? stats.dayStreak}</b><small>Day streak</small></div><div><b>{piProfile?.total_answered ?? stats.totalAnswered}</b><small>Answered</small></div></div>{!piProfile?<><motion.button className="primary-button pi-connect-button" onClick={signInWithPi} disabled={piAuthBusy} whileTap={{scale:.97}}>{piAuthBusy?"Connecting to Pi…":"Sign in with Pi Network"}<ChevronRight size={17}/></motion.button><div className="demo-note"><LockKeyhole size={14}/> {isBackendConfigured()?"For the real sign-in flow, open this app in Pi Browser or Pi Sandbox.":"Backend setup required: add your Supabase project URL and publishable key to .env.local."}</div></>:<><div className="demo-note"><CheckCircle2 size={14}/> Your Pi UID has been verified on the server and your profile is stored in Supabase.</div><button className="text-button centered" onClick={signOutPi}>Sign out of this session</button></>}{piAuthMessage&&<p className="auth-message" role="status">{piAuthMessage}</p>}</div></motion.div>}
      </AnimatePresence>
    </main>

    <footer className="bottom-nav">{navItems.map(n=><motion.button key={n.id} className={view===n.id?"bottom-nav-item active":"bottom-nav-item"} onClick={()=>setView(n.id)} whileTap={{scale:.86,y:-3}}><n.icon size={19}/><span>{n.label}</span></motion.button>)}</footer>
    <AnimatePresence>{toast&&<motion.div className="toast" initial={{opacity:0,y:15}} animate={{opacity:1,y:0}} exit={{opacity:0,y:10}}>{toast}<button onClick={()=>setToast("")}><X size={14}/></button></motion.div>}</AnimatePresence>
  </div>;
}
function ClockIcon(){return <Activity size={14}/>;}
