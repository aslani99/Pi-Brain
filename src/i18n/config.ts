import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: { translation: {
    greeting: "A little curiosity goes a long way.",
    subtitle: "Your daily dose of discovery starts here.",
    daily: "DAILY CHALLENGE", start: "Start today's quiz", continue: "Continue your streak",
    categories: "Explore by curiosity", seeAll: "See all", leaderboard: "Global leaderboard",
    yourProgress: "Your progress", streak: "day streak", points: "points", questions: "questions answered",
    home: "Home", discover: "Discover", rankings: "Rankings", profile: "Profile",
    question: "QUESTION", of: "OF", next: "Continue", check: "Check answer", correct: "Brilliant! That's right.",
    incorrect: "Good try! Here's something new to learn.", explanation: "THE BIG IDEA", finish: "See my result",
    playAgain: "Play another round", back: "Back to home", choose: "Choose the best answer",
    languages: "Language", welcome: "Welcome back", level: "Curiosity explorer"
  }},
  fa: { translation: {
    greeting: "کمی کنجکاوی، دنیایی از کشف می‌سازد.",
    subtitle: "ماجراجویی دانشت از همین‌جا شروع می‌شود.",
    daily: "چالش روزانه", start: "شروع آزمون امروز", continue: "رکوردت را ادامه بده",
    categories: "بر اساس علاقه‌ات کشف کن", seeAll: "مشاهده همه", leaderboard: "جدول رتبه‌بندی جهانی",
    yourProgress: "پیشرفت تو", streak: "روز پیاپی", points: "امتیاز", questions: "سؤال پاسخ‌داده‌شده",
    home: "خانه", discover: "کشف", rankings: "رتبه‌ها", profile: "پروفایل",
    question: "سؤال", of: "از", next: "ادامه", check: "بررسی پاسخ", correct: "آفرین! پاسخ درست است.",
    incorrect: "تلاش خوبی بود! یک نکته تازه یاد گرفتی.", explanation: "نکته جالب", finish: "دیدن نتیجه",
    playAgain: "یک دور دیگر", back: "بازگشت به خانه", choose: "بهترین پاسخ را انتخاب کن",
    languages: "زبان", welcome: "خوش برگشتی", level: "کاوشگر کنجکاوی"
  }},
  ar: { translation: {
    greeting: "القليل من الفضول يقود إلى اكتشافات كبيرة.",
    subtitle: "تبدأ جرعتك اليومية من المعرفة هنا.",
    daily: "تحدي اليوم", start: "ابدأ اختبار اليوم", continue: "واصل إنجازك",
    categories: "اكتشف حسب اهتمامك", seeAll: "عرض الكل", leaderboard: "لوحة المتصدرين العالمية",
    yourProgress: "تقدمك", streak: "أيام متتالية", points: "نقاط", questions: "أسئلة تمت الإجابة عنها",
    home: "الرئيسية", discover: "اكتشف", rankings: "التصنيف", profile: "الملف الشخصي",
    question: "سؤال", of: "من", next: "متابعة", check: "تحقق من الإجابة", correct: "رائع! إجابة صحيحة.",
    incorrect: "محاولة جيدة! إليك معلومة جديدة.", explanation: "الفكرة الأساسية", finish: "عرض النتيجة",
    playAgain: "جولة أخرى", back: "العودة للرئيسية", choose: "اختر أفضل إجابة",
    languages: "اللغة", welcome: "مرحبًا بعودتك", level: "مستكشف المعرفة"
  }},
  es: { translation: { greeting: "Un poco de curiosidad abre grandes mundos.", subtitle: "Tu dosis diaria de descubrimiento empieza aquí.", daily: "RETO DIARIO", start: "Empezar el quiz de hoy", continue: "Mantén tu racha", categories: "Explora por curiosidad", seeAll: "Ver todo", leaderboard: "Clasificación mundial", yourProgress: "Tu progreso", streak: "días seguidos", points: "puntos", questions: "preguntas respondidas", home: "Inicio", discover: "Explorar", rankings: "Ranking", profile: "Perfil", question: "PREGUNTA", of: "DE", next: "Continuar", check: "Comprobar respuesta", correct: "¡Genial! Es correcto.", incorrect: "¡Buen intento! Has aprendido algo nuevo.", explanation: "LA GRAN IDEA", finish: "Ver mi resultado", playAgain: "Otra ronda", back: "Volver al inicio", choose: "Elige la mejor respuesta", languages: "Idioma", welcome: "Qué bueno verte", level: "Explorador curioso" }},
  fr: { translation: { greeting: "Un peu de curiosité ouvre de grands horizons.", subtitle: "Votre dose quotidienne de découverte commence ici.", daily: "DÉFI DU JOUR", start: "Commencer le quiz du jour", continue: "Continuez votre série", categories: "Explorez vos curiosités", seeAll: "Tout voir", leaderboard: "Classement mondial", yourProgress: "Votre progression", streak: "jours de suite", points: "points", questions: "questions répondues", home: "Accueil", discover: "Découvrir", rankings: "Classement", profile: "Profil", question: "QUESTION", of: "SUR", next: "Continuer", check: "Vérifier", correct: "Bravo ! Bonne réponse.", incorrect: "Bien essayé ! Voici une nouvelle découverte.", explanation: "L'IDÉE CLÉ", finish: "Voir mon résultat", playAgain: "Rejouer", back: "Retour", choose: "Choisissez la meilleure réponse", languages: "Langue", welcome: "Bon retour", level: "Explorateur curieux" }},
  de: { translation: { greeting: "Ein bisschen Neugier eröffnet neue Welten.", subtitle: "Deine tägliche Entdeckungsreise beginnt hier.", daily: "TÄGLICHE CHALLENGE", start: "Heutiges Quiz starten", continue: "Bleib in deiner Serie", categories: "Nach Neugier entdecken", seeAll: "Alle ansehen", leaderboard: "Weltweite Rangliste", yourProgress: "Dein Fortschritt", streak: "Tage in Folge", points: "Punkte", questions: "beantwortete Fragen", home: "Start", discover: "Entdecken", rankings: "Rangliste", profile: "Profil", question: "FRAGE", of: "VON", next: "Weiter", check: "Antwort prüfen", correct: "Großartig! Richtig.", incorrect: "Guter Versuch! Etwas Neues gelernt.", explanation: "DIE IDEE", finish: "Ergebnis ansehen", playAgain: "Noch eine Runde", back: "Zurück", choose: "Wähle die beste Antwort", languages: "Sprache", welcome: "Willkommen zurück", level: "Neugier-Entdecker" }},
  pt: { translation: { greeting: "Um pouco de curiosidade abre novos mundos.", subtitle: "Sua dose diária de descobertas começa aqui.", daily: "DESAFIO DIÁRIO", start: "Começar o quiz de hoje", continue: "Mantenha sua sequência", categories: "Explore por curiosidade", seeAll: "Ver tudo", leaderboard: "Ranking global", yourProgress: "Seu progresso", streak: "dias seguidos", points: "pontos", questions: "perguntas respondidas", home: "Início", discover: "Descobrir", rankings: "Ranking", profile: "Perfil", question: "PERGUNTA", of: "DE", next: "Continuar", check: "Conferir resposta", correct: "Muito bem! Correto.", incorrect: "Boa tentativa! Aprenda algo novo.", explanation: "A GRANDE IDEIA", finish: "Ver resultado", playAgain: "Outra rodada", back: "Voltar", choose: "Escolha a melhor resposta", languages: "Idioma", welcome: "Bem-vindo de volta", level: "Explorador curioso" }},
  hi: { translation: { greeting: "थोड़ी जिज्ञासा नई दुनिया खोलती है।", subtitle: "आपकी रोज़ की खोज यहीं से शुरू होती है।", daily: "आज की चुनौती", start: "आज का क्विज़ शुरू करें", continue: "अपनी लय बनाए रखें", categories: "अपनी रुचि से खोजें", seeAll: "सभी देखें", leaderboard: "वैश्विक लीडरबोर्ड", yourProgress: "आपकी प्रगति", streak: "लगातार दिन", points: "अंक", questions: "उत्तर दिए गए प्रश्न", home: "होम", discover: "खोजें", rankings: "रैंकिंग", profile: "प्रोफ़ाइल", question: "प्रश्न", of: "में से", next: "जारी रखें", check: "उत्तर जाँचें", correct: "शानदार! सही उत्तर।", incorrect: "अच्छी कोशिश! कुछ नया सीखें।", explanation: "मुख्य विचार", finish: "परिणाम देखें", playAgain: "एक और राउंड", back: "होम पर वापस", choose: "सबसे अच्छा उत्तर चुनें", languages: "भाषा", welcome: "वापस स्वागत है", level: "जिज्ञासु खोजकर्ता" }},
  zh: { translation: { greeting: "一点好奇心，开启更大的世界。", subtitle: "每日探索，从这里开始。", daily: "每日挑战", start: "开始今日答题", continue: "保持连续挑战", categories: "按兴趣探索", seeAll: "查看全部", leaderboard: "全球排行榜", yourProgress: "你的进度", streak: "连续天数", points: "积分", questions: "已答题目", home: "首页", discover: "探索", rankings: "排行", profile: "个人资料", question: "问题", of: "共", next: "继续", check: "检查答案", correct: "太棒了！回答正确。", incorrect: "不错的尝试！学到新知识了。", explanation: "核心知识", finish: "查看结果", playAgain: "再来一轮", back: "返回首页", choose: "选择最佳答案", languages: "语言", welcome: "欢迎回来", level: "好奇探索者" }},
  ja: { translation: { greeting: "小さな好奇心が、新しい世界を開きます。", subtitle: "毎日の発見はここから始まります。", daily: "デイリーチャレンジ", start: "今日のクイズを始める", continue: "連続記録を続けよう", categories: "興味から探す", seeAll: "すべて見る", leaderboard: "世界ランキング", yourProgress: "あなたの進捗", streak: "日連続", points: "ポイント", questions: "回答した問題", home: "ホーム", discover: "発見", rankings: "ランキング", profile: "プロフィール", question: "問題", of: "/", next: "次へ", check: "答えを確認", correct: "すばらしい！正解です。", incorrect: "いい挑戦です！新しい発見です。", explanation: "ポイント", finish: "結果を見る", playAgain: "もう一度", back: "ホームへ", choose: "最適な答えを選んでください", languages: "言語", welcome: "おかえりなさい", level: "好奇心探究者" }},
  ru: { translation: { greeting: "Немного любопытства открывает большие миры.", subtitle: "Ежедневные открытия начинаются здесь.", daily: "ЕЖЕДНЕВНЫЙ ВЫЗОВ", start: "Начать сегодняшний квиз", continue: "Продолжайте серию", categories: "Исследуйте по интересам", seeAll: "Показать все", leaderboard: "Мировой рейтинг", yourProgress: "Ваш прогресс", streak: "дней подряд", points: "баллов", questions: "отвечено вопросов", home: "Главная", discover: "Открытия", rankings: "Рейтинг", profile: "Профиль", question: "ВОПРОС", of: "ИЗ", next: "Далее", check: "Проверить ответ", correct: "Отлично! Верно.", incorrect: "Хорошая попытка! Вот новое знание.", explanation: "ГЛАВНАЯ МЫСЛЬ", finish: "Мой результат", playAgain: "Ещё раунд", back: "На главную", choose: "Выберите лучший ответ", languages: "Язык", welcome: "С возвращением", level: "Исследователь" }}
};

const rtl = new Set(["fa", "ar", "ur", "he", "ps", "sd", "ug", "yi"]);
i18n.use(initReactI18next).init({
  resources, lng: "en", fallbackLng: "en", interpolation: { escapeValue: false }
});
export function applyLocale(locale: string) {
  const lang = locale.toLowerCase().split("-")[0];
  document.documentElement.lang = lang;
  document.documentElement.dir = rtl.has(lang) ? "rtl" : "ltr";
  void i18n.changeLanguage(resources[lang as keyof typeof resources] ? lang : "en");
}
export default i18n;