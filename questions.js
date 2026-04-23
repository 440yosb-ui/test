// Claude Code 学習クイズ - 問題データ（30問）
const CATEGORIES = [
  { id: "basic",    name: "基本操作",      icon: "🚀", color: "#007aff" },
  { id: "slash",    name: "スラッシュコマンド", icon: "⌨️", color: "#5856d6" },
  { id: "tips",     name: "便利な使い方",   icon: "💡", color: "#ff9500" },
  { id: "security", name: "セキュリティ",   icon: "🔒", color: "#ff3b30" },
  { id: "settings", name: "設定・カスタマイズ", icon: "⚙️", color: "#34c759" }
];

const QUESTIONS = [
  // ===== 基本操作 (8問) =====
  {
    id: 1,
    category: "basic",
    question: "Claude Code とは、どんなツールですか？",
    options: [
      "画像を編集するツール",
      "ターミナル（コマンドライン）からAIと対話してプログラミング作業を手伝ってもらうツール",
      "メールを自動で送るサービス",
      "表計算ソフト"
    ],
    correct: 1,
    explanation: "Claude Code は、Anthropic が提供する公式のコマンドラインツールです。ターミナル上でAIと自然言語で対話しながら、ファイル編集・コード生成・テスト実行などの作業を任せられます。"
  },
  {
    id: 2,
    category: "basic",
    question: "Claude Code を起動するには、ターミナルで何と入力しますか？",
    options: [
      "start",
      "claude",
      "ai",
      "run"
    ],
    correct: 1,
    explanation: "ターミナルで「claude」と入力するだけで対話セッションが始まります。作業したいフォルダ（プロジェクト）に移動してから起動するのが基本です。"
  },
  {
    id: 3,
    category: "basic",
    question: "Claude Code に「このファイルを見て」と伝えたいとき、ファイル名の前に付ける便利な記号は？",
    options: [
      "#（シャープ）",
      "$（ドル）",
      "@（アットマーク）",
      "&（アンド）"
    ],
    correct: 2,
    explanation: "「@ファイル名」のように @ を付けると、そのファイルの内容を一緒に送れます。ファイル名は候補が自動で表示されるので、一覧から選ぶこともできます。"
  },
  {
    id: 4,
    category: "basic",
    question: "Claude Code の会話を終了するには？",
    options: [
      "ウィンドウを力ずくで閉じる",
      "「/exit」と入力、または Ctrl + D を押す",
      "パソコンを再起動する",
      "インターネットを切断する"
    ],
    correct: 1,
    explanation: "「/exit」または Ctrl + D で安全に終了できます。会話の履歴は自動で保存されるので、あとで「claude --resume」や「/resume」で続きから再開できます。"
  },
  {
    id: 5,
    category: "basic",
    question: "Claude の作業（出力）を途中で止めたいときは？",
    options: [
      "何もできない、最後まで待つしかない",
      "Esc キーを押す",
      "Enter を連打する",
      "パソコンをシャットダウンする"
    ],
    correct: 1,
    explanation: "Esc キーで作業を中断できます。「思っていた方向と違う」と気づいたら、すぐに止めて指示を出し直しましょう。やり直しの時間を節約できます。"
  },
  {
    id: 6,
    category: "basic",
    question: "Claude Code に依頼するときのコツとして、最も良いものは？",
    options: [
      "短く「いい感じにして」とだけ伝える",
      "目的と制約（してほしくないこと）を具体的に伝える",
      "すべて英語で書く",
      "敬語を使わない"
    ],
    correct: 1,
    explanation: "「何を・なぜ・どこまで」を明確に伝えるほど、望む結果に近づきます。例:「このページの文字を大きくしたい。ただし他のページには影響を出さないで」のように、範囲も示すと安全です。"
  },
  {
    id: 7,
    category: "basic",
    question: "Claude Code でファイルの内容を少し変更してもらった後、自分で結果を確認する方法は？",
    options: [
      "Claude を信じて確認しない",
      "変更されたファイルを自分で開いて内容を見る／テストを実行する",
      "パソコンを再起動する",
      "確認方法はない"
    ],
    correct: 1,
    explanation: "AI は便利ですが完璧ではありません。変更後は必ず自分の目で見る、テストを動かす、実際に動作を試すなど「人間側での確認」が大切です。"
  },
  {
    id: 8,
    category: "basic",
    question: "前回の会話の続きから再開したいときに便利なコマンドは？",
    options: [
      "/back",
      "/resume",
      "/memory",
      "/again"
    ],
    correct: 1,
    explanation: "「/resume」で過去の会話の一覧が表示され、選んで続きから再開できます。起動時に「claude --resume」と入れても同じ効果があります。"
  },

  // ===== スラッシュコマンド (5問) =====
  {
    id: 9,
    category: "slash",
    question: "使えるコマンドの一覧を表示する「/」で始まるコマンドは？",
    options: [
      "/list",
      "/commands",
      "/help",
      "/menu"
    ],
    correct: 2,
    explanation: "「/help」で利用可能なスラッシュコマンドの一覧と説明が見られます。困ったらまずこれを覚えておくと安心です。"
  },
  {
    id: 10,
    category: "slash",
    question: "今の会話履歴をクリアして、新しいセッションを始めたいときは？",
    options: [
      "/clear",
      "/delete",
      "/new",
      "/reset"
    ],
    correct: 0,
    explanation: "「/clear」で会話履歴をまっさらにできます。話題が変わるときや、AI が前の文脈に引きずられて変な返答をするときに便利です。"
  },
  {
    id: 11,
    category: "slash",
    question: "プロジェクトの内容をまとめた「CLAUDE.md」を自動で作ってくれるコマンドは？",
    options: [
      "/setup",
      "/init",
      "/create",
      "/start"
    ],
    correct: 1,
    explanation: "「/init」で、Claude がプロジェクトを解析して「CLAUDE.md」という説明ファイルを作ってくれます。以降の会話で毎回プロジェクトの前提を説明しなくて済みます。"
  },
  {
    id: 12,
    category: "slash",
    question: "今のセッションで使ったトークン（AIとのやり取りの量）や料金を確認するコマンドは？",
    options: [
      "/price",
      "/usage",
      "/cost",
      "/bill"
    ],
    correct: 2,
    explanation: "「/cost」で現在のセッションのトークン使用量やおおよその料金が表示されます。使いすぎ防止の健康診断として定期的に見るのがおすすめです。"
  },
  {
    id: 13,
    category: "slash",
    question: "会話が長くなってきたとき、要約して文脈を圧縮するコマンドは？",
    options: [
      "/compact",
      "/shrink",
      "/trim",
      "/small"
    ],
    correct: 0,
    explanation: "「/compact」は今までの会話を要約し、大事な情報を残しつつ文脈を軽くします。長時間の作業で Claude の動きが鈍くなってきたら試してみましょう。"
  },

  // ===== 便利な使い方 (7問) =====
  {
    id: 14,
    category: "tips",
    question: "プロジェクト固有のルール（例:「日本語で答えて」「このフォルダは触らないで」）を毎回伝えなくて済むようにする方法は？",
    options: [
      "毎回コピペして貼り付ける",
      "「CLAUDE.md」というファイルにルールを書いておく",
      "紙に書いて机に貼る",
      "方法はない"
    ],
    correct: 1,
    explanation: "プロジェクトのルートに「CLAUDE.md」を置くと、Claude が起動時に自動で読み込みます。「常に日本語で」「このフォルダは編集しない」などの共通ルールをまとめておくと便利です。"
  },
  {
    id: 15,
    category: "tips",
    question: "大きな変更を加える前に、先に「何をするつもりか」を確認できるモードは？",
    options: [
      "プランモード（Plan mode）",
      "ダークモード",
      "サイレントモード",
      "機内モード"
    ],
    correct: 0,
    explanation: "プランモード（Shift + Tab で切替）では、Claude がまず計画を立てて提示し、承認してから作業を開始します。大きな変更や不慣れな作業で役立つ「考えてから動く」モードです。"
  },
  {
    id: 16,
    category: "tips",
    question: "「スクリーンショットのこのエラーを直して」と画像で伝えたいとき、iPhone/PC では？",
    options: [
      "画像は使えない、文字で説明するしかない",
      "画像ファイルをターミナルにドラッグ＆ドロップする／貼り付ける",
      "FAX で送る",
      "音声で伝える"
    ],
    correct: 1,
    explanation: "Claude Code は画像を理解できます。スクリーンショットをコピーして貼り付けるか、ファイルをドラッグすれば、画像を見ながら答えてくれます。"
  },
  {
    id: 17,
    category: "tips",
    question: "複数の作業をまとめて頼みたいとき、Claude が使う「進捗管理」の仕組みは？",
    options: [
      "Todo リスト",
      "カレンダー",
      "メール下書き",
      "ブックマーク"
    ],
    correct: 0,
    explanation: "Claude は複雑なタスクを自動で Todo リストに分解し、一つずつ進めながら進捗を表示します。進み具合が見えるので、長い作業でも安心して任せられます。"
  },
  {
    id: 18,
    category: "tips",
    question: "専門的な作業（例: コードレビュー、調査）を「別の専門スタッフ」に任せる仕組みは？",
    options: [
      "サブエージェント（subagent）",
      "サブスクリプション",
      "サブタイトル",
      "サブフォルダ"
    ],
    correct: 0,
    explanation: "サブエージェントは特定の役割に特化した「別働隊」です。メインの会話を汚さずに、調査や専門作業を並行させられます。指示を出すだけでメインのClaudeが自動で呼び出します。"
  },
  {
    id: 19,
    category: "tips",
    question: "Claude に依頼するとき、失敗しにくいやり方は？",
    options: [
      "全部まとめて一気にお願いする",
      "小さく分けて、1ステップずつ確認しながら進める",
      "指示は最小限にして、あとは察してもらう",
      "夜中にお願いする"
    ],
    correct: 1,
    explanation: "大きな依頼はミスが起きやすく、修正も大変です。「まずA、次にB」と小さく分けて進めると、途中で軌道修正でき、結果的に早く正確に終わります。"
  },
  {
    id: 20,
    category: "tips",
    question: "Claude Code にインターネットの情報（最新ドキュメントなど）を調べさせたいとき、使える機能は？",
    options: [
      "Web 検索・Web 取得（WebSearch / WebFetch）",
      "テレパシー",
      "エスパー機能",
      "不可能"
    ],
    correct: 0,
    explanation: "Claude Code は WebSearch（検索）や WebFetch（指定 URL の取得）でネット上の情報を参照できます。「最新のXの公式ドキュメントを調べて」のように依頼できます。"
  },

  // ===== セキュリティ (6問) =====
  {
    id: 21,
    category: "security",
    question: "Claude がコマンドを実行しようとすると「許可しますか？」と聞かれます。これはなぜ大事？",
    options: [
      "邪魔なだけなので、全部「常に許可」にすべき",
      "意図しない操作（ファイル削除など）を防ぐための安全装置なので、内容をよく読むべき",
      "デザイン上の飾り",
      "広告を出すため"
    ],
    correct: 1,
    explanation: "確認プロンプトは、あなたの環境を守る最後の砦です。特に rm（削除）や git push など「取り返しのつかない操作」は、必ず内容を確認してから許可しましょう。"
  },
  {
    id: 22,
    category: "security",
    question: "API キーやパスワードが書かれた「.env」ファイルを Claude に見せるときは？",
    options: [
      "気にせずそのまま見せる",
      "基本的には見せない。見せる場合も、ダミー値に置き換えるなど注意する",
      "SNS にも投稿する",
      "ブログに載せる"
    ],
    correct: 1,
    explanation: "API キーやパスワードは外に漏れると不正利用されます。.env などの機密ファイルは共有しない、どうしても必要なら値をマスクするのが鉄則です。"
  },
  {
    id: 23,
    category: "security",
    question: "「--dangerously-skip-permissions」という起動オプションはどんな効果？",
    options: [
      "画面を暗くする",
      "確認プロンプトをすべてスキップする（危険度が高いので通常は使わない）",
      "動作を速くする魔法",
      "テーマを変える"
    ],
    correct: 1,
    explanation: "名前のとおり「危険なので権限確認を飛ばす」オプションです。信頼できる隔離環境（コンテナなど）以外では使わないのが安全です。"
  },
  {
    id: 24,
    category: "security",
    question: "よく知らない人が作ったリポジトリを Claude Code で開くときの注意は？",
    options: [
      "すぐにすべて「常に許可」にする",
      "CLAUDE.md などに悪意のある指示（プロンプトインジェクション）が仕込まれている可能性があるので慎重に",
      "中身を確認せずに実行する",
      "特に気にしなくていい"
    ],
    correct: 1,
    explanation: "外部のプロジェクトには、AI を操るような悪意ある指示が隠れていることがあります（プロンプトインジェクション）。初回は「まず読むだけ」にして、内容を確認してから作業を進めましょう。"
  },
  {
    id: 25,
    category: "security",
    question: "Claude に git の操作を頼むとき、特に慎重にすべき操作は？",
    options: [
      "git status（状態を見るだけ）",
      "git log（履歴を見るだけ）",
      "git push --force（リモートを強制的に上書き）",
      "git diff（差分を見るだけ）"
    ],
    correct: 2,
    explanation: "「git push --force」は他人の変更も上書きしてしまう破壊的な操作です。「git reset --hard」「rm -rf」「branch -D」なども同様に、実行前に必ず内容を確認しましょう。"
  },
  {
    id: 26,
    category: "security",
    question: "うっかり機密ファイルを Claude に見せてしまったら、どうするのが良い？",
    options: [
      "そのまま放置",
      "漏れた可能性のあるパスワード・API キーはすぐに無効化して再発行する",
      "見なかったことにする",
      "SNS で謝罪する"
    ],
    correct: 1,
    explanation: "一度外に出た秘密情報は戻せません。「すぐに無効化して作り直す（ローテート）」のが最も安全な対処です。普段から .gitignore で保護し、事故を起こさない設計が理想です。"
  },

  // ===== 設定・カスタマイズ (4問) =====
  {
    id: 27,
    category: "settings",
    question: "使用するモデル（Opus / Sonnet / Haiku など）を切り替えるコマンドは？",
    options: [
      "/model",
      "/switch",
      "/ai",
      "/brain"
    ],
    correct: 0,
    explanation: "「/model」で現在のモデルを確認・変更できます。難しい作業は賢いモデル、軽い作業は高速なモデル、と使い分けると料金とスピードのバランスが取れます。"
  },
  {
    id: 28,
    category: "settings",
    question: "自分専用の設定（許可リストや環境変数）を書くファイル名は？",
    options: [
      "config.txt",
      "settings.json",
      "memo.md",
      "readme.doc"
    ],
    correct: 1,
    explanation: "「~/.claude/settings.json」（ユーザー全体）や「.claude/settings.json」（プロジェクト共通）、「.claude/settings.local.json」（自分だけ・Git に含めない）で細かく設定できます。"
  },
  {
    id: 29,
    category: "settings",
    question: "「Claude が特定の操作をする前後に、自動で何かを実行する」仕組みを何と呼ぶ？",
    options: [
      "フック（Hooks）",
      "ボタン",
      "リンク",
      "タグ"
    ],
    correct: 0,
    explanation: "Hooks は「ファイル保存後に自動でテスト」「コマンド実行前にチェック」など、決まったタイミングで自動処理を差し込める仕組みです。設定は settings.json に書きます。"
  },
  {
    id: 30,
    category: "settings",
    question: "Claude Code の機能を外部サービス（GitHub や Slack など）と連携させて拡張する仕組みは？",
    options: [
      "MCP（Model Context Protocol）サーバー",
      "LAN ケーブル",
      "SD カード",
      "Bluetooth"
    ],
    correct: 0,
    explanation: "MCP は Claude と外部ツールをつなぐ共通ルールです。GitHub 操作・データベース閲覧・Slack 送信など、目的に合ったサーバーを追加すると Claude ができることが広がります。"
  }
];
