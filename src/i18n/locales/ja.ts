const base = { translation: { greeting: "小さな好奇心が、新しい世界を開きます。", subtitle: "毎日の発見はここから始まります。", daily: "デイリーチャレンジ", start: "今日のクイズを始める", continue: "連続記録を続けよう", categories: "興味から探す", seeAll: "すべて見る", leaderboard: "世界ランキング", yourProgress: "あなたの進捗", streak: "日連続", points: "ポイント", questions: "回答した問題", home: "ホーム", discover: "発見", rankings: "ランキング", profile: "プロフィール", question: "問題", of: "/", next: "次へ", check: "答えを確認", correct: "すばらしい！正解です。", incorrect: "いい挑戦です！新しい発見です。", explanation: "ポイント", finish: "結果を見る", playAgain: "もう一度", back: "ホームへ", choose: "最適な答えを選んでください", languages: "言語", welcome: "おかえりなさい", level: "好奇心探究者" }};
const additional = {
    audioSettingsTitle: "音声設定",
    soundEffectsSetting: "クリック音と効果音",
    backgroundMusicSetting: "バックグラウンド音楽",
    musicVolumeSetting: "音楽の音量",
    quizLanguageHelp: "クイズの問題に使用する言語を選択します。この設定は画面表示の言語とは独立しています。",
    questionBankEmptyForLocale: "クイズ言語 {{locale}} で承認済みのカテゴリーはありません。画面表示の言語とクイズの言語は異なっていてもかまいません。",
    switchQuizToEnglish: "問題に英語を使用する",
    questionBankExhausted: "この言語とクイズ経路の承認済み問題にはすべて回答済みです。",

    quizLanguage: "クイズの言語",
demoTranslationUnavailable: '一部のデモ問題はまだその言語に翻訳されていません。このラウンドでは現在の言語を維持してください。',     openMenu: "メニューを開く", closeMenu: "メニューを閉じる", chooseTheme: "テーマを選択", themes: "テーマ", chooseUniverse: "自分の宇宙を選ぶ", personalizeAppearance: "表示をカスタマイズ", close: "閉じる", lightMode: "ライトモード", darkMode: "ダークモード", lightThemeTip: "明るい表示にはライトテーマをお試しください。", reduceMotion: "動きを減らす", on: "オン", off: "オフ", muteSound: "音をミュート", enableSound: "音を有効にする", soundOn: "音声オン", soundOff: "音声オフ", openProfile: "プロフィールを開く",
    brandHomeLabel: "Pi Brain ホーム", cosmicQuiz: "コズミッククイズ", liveQuest: "ライブチャレンジ", heroTitleLine1: "まだ見ぬ世界を", heroTitleLine2: "探検する準備はできた？", heroDescription: "好奇心旺盛な相棒が待っています。驚きの質問、興味深い事実、すばらしい発見の世界へ飛び込みましょう。", coPilot: "あなたの宇宙の相棒", minutes: "5分", stageBasedQuiz: "ステージ制クイズ", keepSparkAlive: "好奇心の火を絶やさずに", curiosityAddsUp: "好奇心が積み重なる", findNextSpark: "次のひらめきを見つけよう", thisWeek: "今週", yourJourney: "あなたの歩み", accuracy: "正答率", keepExploring: "探索を続けよう！", firstAnswerProgress: "最初の問題に答えると、進捗の記録が始まります。",
    stageNumber: "ステージ {{stage}}", questionCount: "{{count}}問", readyWhen: "準備ができたら始めよう！", niceWork: "よくできました！", savingAnswer: "回答を保存中…", loadingQuestion: "問題を読み込み中…", dailyChallengeComplete: "デイリーチャレンジ完了", resultHeadline: "好奇心が輝いています。", resultDescription: "新しいことを発見する時間を作れました。それは素晴らしい成果です。", scoreOfQuestions: "{{total}}問中 {{score}}問正解", earnedToday: "今日獲得", streakProgress: "連続記録の進捗", worldOfIdeas: "アイデアの世界", discoverLead: "問いを追いかけ、新しい興味を見つけ、探索を続けよう。", randomQuestions: "ランダムな問題", approvedCategories: "承認済みの全カテゴリ", globalCommunity: "グローバルコミュニティ", communityLead: "毎日の好奇心をみんなで楽しもう。", noScores: "Pioneer のスコアはまだ記録されていません。サーバークイズを完了するとここに表示されます。", completeQuizForRank: "サーバークイズを完了するとここに表示されます。", liveLeaderboard: "認証済み Pi ユーザー向けの Supabase ライブランキング。", previewOnly: "プレビュー用データのみ", signInForLeaderboard: "Pi でログインして世界ランキングを読み込みましょう。", yourSpace: "あなたのスペース", guestExplorer: "ゲスト探索者", piIdentityVerified: "Pi Network の本人確認済み", connectPiIdentity: "Pi ID を連携して、世界共通の Pioneer プロフィールを作成しましょう。", verifiedWithPi: "PI NETWORK で確認済み", dayStreakLabel: "連続日数", answeredLabel: "回答済み", connecting: "Pi に接続中…", signInWithPi: "Pi Network でログイン", openPiBrowser: "実際にログインするには、Pi Browser または Pi Sandbox でこのアプリを開いてください。", backendSetup: "バックエンド設定が必要です。Supabase のプロジェクト URL と公開キーを .env.local に追加してください。", piUidSaved: "Pi UID はサーバーで確認され、プロフィールは Supabase に保存されています。", signOutSession: "このセッションからログアウト", questionHelpServer: "すべての問題に回答すると、現在のステージが進みます。", questionHelpDemo: "進捗はこのデモセッションに保存されます。", questionBankEmpty: "この言語とクイズ経路には、まだ承認済みの問題がありません。", questionBankInsufficient: "このステージに必要な未回答の承認済み問題が、選択した言語では不足しています。ステージは変更されていません。", categoryUnavailable: "このカテゴリには選択した言語の承認済み問題がまだありません。", genericError: "問題が発生しました。もう一度お試しください。", catalogLoadError: "クイズカテゴリを読み込めませんでした。", prefsLoadError: "アカウント設定を読み込めませんでした。", prefsSyncError: "アカウント設定を同期できませんでした。端末内の設定は引き続き利用できます。", sessionExpired: "Pi セッションの有効期限が切れました。再度ログインしてください。", loginRequired: "続行するには Pi でログインしてください。", moreQuestionsComing: "このテーマの新しいオリジナル問題を準備しています。", finishQuizBeforeLanguageChange: "言語を変更する前に、現在の Pi クイズを終了してください。同じラウンドの問題は一つの言語に統一されます。", serverQuestionLoadError: "サーバーから問題を取得できませんでした。", answerSaveError: "回答を保存できませんでした。もう一度お試しください。", profileNotFound: "Pi プロフィールが見つかりません。再度ログインしてください。"
  };
const status = { documentTitle: "Pi Brain — その先を考えよう", documentDescription: "Pi Brain — 宇宙を舞台にしたクイズの冒険。探索し、楽しみながら知識を広げよう。", progressSummary: "{{total}}問中{{correct}}問正解。探索を続けよう！", settingsRestoredFromAnotherDevice: "別の端末で使用していた最新の設定を復元しました。", demoMode: "デモ", you: "あなた", signedOut: "Pi からログアウトしました。再度ログインするには Pi 接続を選択してください。", themeCosmic: "コズミック", themeLight: "ライト", themeOcean: "オーシャン", themeAurora: "オーロラ", themeSunset: "サンセット", themeRoyal: "ロイヤル", themeRose: "ローズ", oneDay: "+1 日", mascotCelebrating: "お祝いする Pi Brain ロボット" };

const resource = {
  ...base.translation,
  ...additional,
  ...status,
};

export default resource;
