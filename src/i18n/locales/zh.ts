const base = { translation: { greeting: "一点好奇心，开启更大的世界。", subtitle: "每日探索，从这里开始。", daily: "每日挑战", start: "开始今日答题", continue: "保持连续挑战", categories: "按兴趣探索", seeAll: "查看全部", leaderboard: "全球排行榜", yourProgress: "你的进度", streak: "连续天数", points: "积分", questions: "已答题目", home: "首页", discover: "探索", rankings: "排行", profile: "个人资料", question: "问题", of: "共", next: "继续", check: "检查答案", correct: "太棒了！回答正确。", incorrect: "不错的尝试！学到新知识了。", explanation: "核心知识", finish: "查看结果", playAgain: "再来一轮", back: "返回首页", choose: "选择最佳答案", languages: "语言", welcome: "欢迎回来", level: "好奇探索者" }};
const additional = {
    heroDescriptionCompact: "你的探索伙伴已就绪！",
    leaderboardCountPrefix: "目前已有",
    leaderboardCountSuffix: "人参与",
    winnerTrophyLabel: "第一名奖杯",
    leaderboardTop10: "按 XP 排名的前 10 位 Pi 认证用户。",
    leaderboardPublicNote: "前 10 位 Pi 认证用户的 XP 排名。",
    audioSettingsTitle: "音频设置",
    soundEffectsSetting: "点击音效",
    backgroundMusicSetting: "背景音乐",
    musicVolumeSetting: "音乐音量",
    quizLanguageHelp: "选择测验题目的语言。此设置独立于界面语言。",
    questionBankEmptyForLocale: "测验语言 {{locale}} 暂无已批准的类别。界面语言可以与测验语言不同。",
    switchQuizToEnglish: "使用英语显示测验题目",
    questionBankExhausted: "你已回答此语言和测验路径中的所有已批准问题。",

    quizLanguage: "测验语言",
demoTranslationUnavailable: '部分演示题目尚未翻译成该语言。请在本轮中保持当前语言。',     openMenu: "打开菜单", closeMenu: "关闭菜单", chooseTheme: "选择主题", themes: "主题", chooseUniverse: "选择你的宇宙", personalizeAppearance: "自定义外观", close: "关闭", lightMode: "浅色模式", darkMode: "深色模式", lightThemeTip: "试试浅色主题，让界面更明亮。", reduceMotion: "减少动态效果", on: "开", off: "关", muteSound: "静音", enableSound: "启用声音", soundOn: "声音已开", soundOff: "声音已关", openProfile: "打开个人资料",
    brandHomeLabel: "BrainQuiz 首页", cosmicQuiz: "宇宙问答", liveQuest: "实时挑战", heroTitleLine1: "准备好探索", heroTitleLine2: "看似不可能的事物了吗？", heroDescription: "你的好奇心伙伴已经准备就绪。进入一个充满惊喜问题、精彩知识和奇妙发现的世界吧。", coPilot: "你的宇宙伙伴", minutes: "5 分钟", stageBasedQuiz: "分阶段问答", keepSparkAlive: "让好奇心持续闪耀", curiosityAddsUp: "好奇心不断积累", findNextSpark: "寻找下一束灵感", thisWeek: "本周", yourJourney: "你的旅程", accuracy: "正确率", keepExploring: "继续探索！", firstAnswerProgress: "回答第一个问题后，你的进度之旅就会开始。",
    stageNumber: "第 {{stage}} 阶段", questionCount: "{{count}} 道题", readyWhen: "你准备好时，我们就准备好了！", niceWork: "做得好！", savingAnswer: "正在保存答案…", loadingQuestion: "正在加载问题…", dailyChallengeComplete: "每日挑战已完成", resultHeadline: "好奇心让你闪闪发光。", resultDescription: "你抽出时间发现了新知识，这就是一次胜利。", scoreOfQuestions: "答对 {{score}} / {{total}} 题", earnedToday: "今日获得", streakProgress: "连续挑战进度", worldOfIdeas: "创意的世界", discoverLead: "追随一个问题，发现新的兴趣，继续探索。", randomQuestions: "随机问题", approvedCategories: "所有已批准类别", globalCommunity: "全球社区", communityLead: "一起庆祝每天的好奇心。", noScores: "尚无 Pioneer 分数记录。完成服务器问答后即可显示在这里。", completeQuizForRank: "完成服务器问答后即可显示在这里。", liveLeaderboard: "已验证 Pi 用户的 Supabase 实时排行榜。", previewOnly: "仅为预览数据", signInForLeaderboard: "使用 Pi 登录以加载全球实时排行榜。", yourSpace: "你的空间", guestExplorer: "访客探索者", piIdentityVerified: "Pi Network 身份已验证", connectPiIdentity: "连接你的 Pi 身份，创建全球 Pioneer 个人资料。", verifiedWithPi: "已通过 PI NETWORK 验证", dayStreakLabel: "连续天数", answeredLabel: "已回答", connecting: "正在连接 Pi…", signInWithPi: "使用 Pi Network 登录", openPiBrowser: "如需真实登录，请在 Pi Browser 或 Pi Sandbox 中打开此应用。", backendSetup: "需要配置后端：将 Supabase 项目网址和公开密钥添加到 .env.local。", piUidSaved: "你的 Pi UID 已在服务器验证，个人资料已保存到 Supabase。", signOutSession: "退出此会话", questionHelpServer: "回答完所有问题后，当前阶段才会推进。", questionHelpDemo: "你的进度保存在本次演示会话中。", questionBankEmpty: "此语言和测验路径目前还没有已批准的问题。", questionBankInsufficient: "所选语言中没有足够的未答且已批准的问题供此阶段使用。阶段未发生变化。", categoryUnavailable: "此类别暂时没有所选语言的已批准问题。", genericError: "发生错误，请重试。", catalogLoadError: "无法加载问答类别。", prefsLoadError: "无法加载账户偏好设置。", prefsSyncError: "无法同步账户设置。本地设置仍可使用。", sessionExpired: "Pi 会话已过期，请重新登录。", loginRequired: "请使用 Pi 登录后继续。", moreQuestionsComing: "正在为此主题准备更多原创问题。", finishQuizBeforeLanguageChange: "切换语言前，请先退出当前 Pi 问答。同一轮中的所有问题必须保持同一种语言。", serverQuestionLoadError: "服务器未能发送问题。", answerSaveError: "无法保存答案，请重试。", profileNotFound: "未找到你的 Pi 个人资料，请重新登录。"
  };
const status = { documentTitle: "BrainQuiz — 思考更广阔", documentDescription: "BrainQuiz — 你的宇宙知识问答冒险。探索、畅玩并不断增长知识。", progressSummary: "{{total}} 题中答对 {{correct}} 题。继续探索！", settingsRestoredFromAnotherDevice: "已恢复你在另一台设备上的最新设置。", demoMode: "演示", you: "你", signedOut: "你已退出 Pi。选择 Pi 连接即可重新登录。", themeCosmic: "宇宙", themeLight: "浅色", themeOcean: "海洋", themeAurora: "极光", themeSunset: "日落", themeRoyal: "皇家", themeRose: "玫瑰", oneDay: "+1 天", mascotCelebrating: "正在庆祝的 BrainQuiz 机器人" };

const answerStatLabels = {
  correctAnswersStat: "正确回答",
  wrongAnswersStat: "错误回答",
};

const resource = {
  ...base.translation,
  ...answerStatLabels,
  ...additional,
  ...status,
};

export default resource;
