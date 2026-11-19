const base = { translation: {
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
  }};
const additional = {
    heroDescriptionCompact: "Your co-pilot is ready!",
    audioSettingsTitle: "Audio settings",
    soundEffectsSetting: "Sound effects and clicks",
    backgroundMusicSetting: "Background music",
    musicVolumeSetting: "Music volume",
    questionBankExhausted: "You have answered every approved question in this language and quiz path.",

    settings: "Settings",
    questionBankEmptyForLocale: "No approved quiz categories are available for quiz language {{locale}}. The interface language can differ from the quiz language.",
    switchQuizToEnglish: "Use English for quiz questions",
    quizLanguage: "Quiz language",
    quizLanguageHelp: "Choose the language used for quiz questions. This setting is independent of the interface language.",

demoTranslationUnavailable: 'Some demo questions are not translated into that language yet. Keep the current language for this round.',     openMenu: "Open menu", closeMenu: "Close menu", chooseTheme: "Choose theme", themes: "Themes", chooseUniverse: "Choose your universe", personalizeAppearance: "Personalize your appearance", close: "Close", lightMode: "Light mode", darkMode: "Dark mode", lightThemeTip: "Try a light theme for a brighter look.", reduceMotion: "Reduce motion", on: "On", off: "Off", muteSound: "Mute sound", enableSound: "Enable sound", soundOn: "Sound on", soundOff: "Sound off", openProfile: "Open profile",
    brandHomeLabel: "Pi Brain home", cosmicQuiz: "COSMIC QUIZ", liveQuest: "LIVE QUEST", heroTitleLine1: "Ready to explore", heroTitleLine2: "the impossible?", heroDescription: "Your curious co-pilot is ready. Jump into a universe of surprising questions, fascinating facts and brilliant discoveries.", coPilot: "YOUR COSMIC CO-PILOT", minutes: "5 min", stageBasedQuiz: "Stage-based quiz", keepSparkAlive: "Keep your spark alive", curiosityAddsUp: "Your curiosity adds up", findNextSpark: "FIND YOUR NEXT SPARK", thisWeek: "THIS WEEK", yourJourney: "YOUR JOURNEY", accuracy: "Accuracy", keepExploring: "Keep exploring!", firstAnswerProgress: "Your first answered question will start your progress journey.",
    stageNumber: "Stage {{stage}}", questionCount: "{{count}} questions", readyWhen: "Ready when you are!", niceWork: "NICE WORK!", savingAnswer: "Saving answer…", loadingQuestion: "Loading question…", dailyChallengeComplete: "DAILY CHALLENGE COMPLETE", resultHeadline: "Curiosity looks good on you.", resultDescription: "You made time to discover something new. That's a win.", scoreOfQuestions: "{{score}} / {{total}} correct", earnedToday: "Earned today", streakProgress: "Streak progress", worldOfIdeas: "A WORLD OF IDEAS", discoverLead: "Follow a question. Find a new interest. Keep exploring.", randomQuestions: "Random questions", approvedCategories: "All approved categories", globalCommunity: "THE GLOBAL COMMUNITY", communityLead: "A friendly celebration of daily curiosity.", noScores: "No Pioneer scores have been recorded yet. Complete a server quiz to appear here.", completeQuizForRank: "Complete a server quiz to appear here.", liveLeaderboard: "Live Supabase leaderboard for verified Pi users.", previewOnly: "Preview data only", signInForLeaderboard: "Sign in with Pi to load the live global leaderboard.", yourSpace: "YOUR SPACE", guestExplorer: "Guest Explorer", piIdentityVerified: "Pi Network identity verified", connectPiIdentity: "Connect your Pi identity to create your global Pioneer profile.", verifiedWithPi: "VERIFIED WITH PI NETWORK", dayStreakLabel: "Day streak", answeredLabel: "Answered", connecting: "Connecting to Pi…", signInWithPi: "Sign in with Pi Network", openPiBrowser: "For the real sign-in flow, open this app in Pi Browser or Pi Sandbox.", backendSetup: "Backend setup required: add your Supabase project URL and publishable key to .env.local.", piUidSaved: "Your Pi UID has been verified on the server and your profile is stored in Supabase.", signOutSession: "Sign out of this session", questionHelpServer: "Your current stage advances only after every question is answered.", questionHelpDemo: "Your progress is saved in this demo session.", questionBankEmpty: "No approved questions exist in this language and quiz path yet.", questionBankInsufficient: "There are not enough unseen approved questions in your selected language for this stage. Your stage has not changed.", categoryUnavailable: "This category has no approved questions in your selected language yet.", genericError: "Something went wrong. Please try again.", catalogLoadError: "Could not load quiz categories.", prefsLoadError: "Could not load account preferences.", prefsSyncError: "Could not synchronize account preferences. Your local settings are still available.", sessionExpired: "Your Pi session has expired. Sign in again.", loginRequired: "Sign in with Pi to continue.", moreQuestionsComing: "More original questions are being prepared for this topic.", finishQuizBeforeLanguageChange: "Leave the current Pi quiz before changing languages. Questions in one round must stay in a single language.", serverQuestionLoadError: "The server did not deliver the question.", answerSaveError: "Your answer could not be saved. Please try again.", profileNotFound: "Your Pi profile was not found. Sign in again."
  };
const leaderboardLabels = {
    leaderboardCountPrefix: "So far",
    leaderboardCountSuffix: "people have joined",
    winnerTrophyLabel: "First-place trophy",
    leaderboardTop10: "Top 10 Pi-verified Pioneers ranked by total XP.",
    leaderboardLoading: "Loading live rankings…",
    leaderboardLoadError: "Could not load the rankings right now.",
    leaderboardRetry: "Try again",
    leaderboardEmpty: "No verified Pioneers appear on the leaderboard yet.",
    leaderboardPublicNote: "Top 10 verified Pi players, ranked by total XP.",
};

const status = { documentTitle: "Pi Brain — Think Beyond", documentDescription: "Pi Brain — your cosmic quiz adventure. Explore, play and rise in knowledge.", progressSummary: "{{correct}} correct answers out of {{total}}. Keep exploring!", settingsRestoredFromAnotherDevice: "Your latest settings from another device have been restored.", demoMode: "Demo", you: "You", signedOut: "You have signed out of Pi. Select Pi connection to sign in again.", themeCosmic: "Cosmic", themeLight: "Light", themeOcean: "Ocean", themeAurora: "Aurora", themeSunset: "Sunset", themeRoyal: "Royal", themeRose: "Rose", oneDay: "+1 day", mascotCelebrating: "Pi Brain robot celebrating" };

const resource = {
  ...base.translation,
  ...additional,
  ...status,
  ...leaderboardLabels,
};

export default resource;
