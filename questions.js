// Claude Code 学習クイズ - 問題データ（30問）
// type: "choice" = 4択, "input" = コード入力
const CATEGORIES = [
  { id: "basic",    name: "基本操作",       icon: "🚀", color: "#007aff" },
  { id: "slash",    name: "スラッシュコマンド", icon: "⌨️", color: "#5856d6" },
  { id: "tips",     name: "便利な使い方",    icon: "💡", color: "#ff9500" },
  { id: "security", name: "セキュリティ",    icon: "🔒", color: "#ff3b30" },
  { id: "settings", name: "設定・カスタマイズ", icon: "⚙️", color: "#34c759" }
];

const QUESTIONS = [
  // ===== 基本操作（4択・5問） =====
  {
    id: 1,
    category: "basic",
    type: "choice",
    question: "Claude Code はどんなツールですか？",
    options: [
      "ブラウザで使うチャット型AI（ChatGPT風のWebサービス）",
      "ターミナル（コマンドライン）上でAIと対話し、ファイル編集・コード生成・テスト実行まで任せられるCLIツール",
      "VSCodeの拡張機能として動く、コード補完専用のAI",
      "クラウドで24時間動き続けるサーバー型の自動コーディングAI"
    ],
    correct: 1,
    explanation: "Claude Code は Anthropic が提供するCLI（コマンドラインツール）で、ターミナルからAIに作業を依頼できます。類似のブラウザAIや補完ツールとは違い、実際にあなたのPC上でファイル操作やコマンド実行を行える点が特徴です。"
  },
  {
    id: 2,
    category: "basic",
    type: "choice",
    question: "Claudeが作業中に「この方向は違う」と気づいた。途中で止める最も適切な方法は？",
    options: [
      "Ctrl + C を押して強制終了する",
      "Esc キーを押して応答を中断する",
      "Tab キーを連打して注意を引く",
      "ターミナルのウィンドウをそのまま閉じる"
    ],
    correct: 1,
    explanation: "Esc で現在の応答のみを中断できます（会話は続きます）。Ctrl + C は Claude Code 自体が終了してしまい、ウィンドウを閉じると意図しない状態で切断される可能性があります。"
  },
  {
    id: 3,
    category: "basic",
    type: "choice",
    question: "プロジェクト固有のルール（例: 日本語で答える・このフォルダは触らない）を毎回の会話で自動的に読み込ませるには？",
    options: [
      "README.md に書いておく",
      "~/.bashrc に書いておく",
      "プロジェクトのルートに CLAUDE.md を置く",
      ".claude/prompt.txt を作成する"
    ],
    correct: 2,
    explanation: "CLAUDE.md はプロジェクトルートに置くと Claude が起動時に自動で読み込みます。README.md は人間向けの説明、~/.bashrc はシェル起動設定で Claude とは無関係です。"
  },
  {
    id: 4,
    category: "basic",
    type: "choice",
    question: "会話で `src/app.js` というファイルの内容を見てもらいたい。最も簡単で正確なやり方は？",
    options: [
      "ファイル全体をコピー＆ペーストで貼り付ける",
      "ファイル名を書いて「読んで」とだけ伝える",
      "`@src/app.js` のように @ を先頭に付けて参照する",
      "先にファイルをGitHubにpushしてURLを渡す"
    ],
    correct: 2,
    explanation: "「@ファイルパス」で正確にファイルを指定できます。入力中に候補が表示されるのでタイポも防げます。コピペは量が多いと手間で、URL指定は公開が必要になり余計な手順です。"
  },
  {
    id: 5,
    category: "basic",
    type: "choice",
    question: "Claudeに依頼するとき、失敗を減らす最も効果的なやり方は？",
    options: [
      "1回の指示にできるだけ多くの要件を詰め込む",
      "ゴールと制約（してほしくないこと）を明確にして、小さな単位で進める",
      "専門用語は避け、抽象的にふんわり伝える",
      "最初に全て決めず、会話の流れに任せる"
    ],
    correct: 1,
    explanation: "ゴール・範囲・制約を具体的に伝え、小さく進めるのが定石です。詰め込みは誤解や副作用を招き、抽象的な指示は「良かれと思って」余計な変更を生みます。"
  },

  // ===== スラッシュコマンド（4択・4問） =====
  {
    id: 6,
    category: "slash",
    type: "choice",
    question: "現在のセッションで使ったトークン量とおおよその料金を確認するスラッシュコマンドは？",
    options: [
      "/usage",
      "/tokens",
      "/cost",
      "/billing"
    ],
    correct: 2,
    explanation: "/cost がトークン使用量と料金を表示します。使いすぎ防止の「健康診断」として定期的に確認するのがおすすめです。/usage や /billing は Claude Code のコマンドではありません。"
  },
  {
    id: 7,
    category: "slash",
    type: "choice",
    question: "会話が長くなり文脈が重くなってきた。要約して圧縮するスラッシュコマンドは？",
    options: [
      "/summary",
      "/compact",
      "/squash",
      "/condense"
    ],
    correct: 1,
    explanation: "/compact は会話を要約しつつ重要な情報を残します。似た名前はありません。長時間の作業で応答が鈍くなったと感じたら試してみましょう。"
  },
  {
    id: 8,
    category: "slash",
    type: "choice",
    question: "話題が変わったので会話履歴を一度リセットしたい。最も適切なコマンドは？",
    options: [
      "/reset（全設定を初期化）",
      "/delete（履歴を完全削除）",
      "/clear（現在の会話文脈をクリア）",
      "/new（新プロジェクトを作成）"
    ],
    correct: 2,
    explanation: "/clear は現在の会話文脈だけをリセットするコマンドです。設定や過去の会話履歴は残ります。他の選択肢はいずれも存在しないか、意図が違うコマンドです。"
  },
  {
    id: 9,
    category: "slash",
    type: "choice",
    question: "プロジェクトを解析して CLAUDE.md を自動生成してくれるスラッシュコマンドは？",
    options: [
      "/setup",
      "/scan",
      "/analyze",
      "/init"
    ],
    correct: 3,
    explanation: "/init は現在のプロジェクトを解析し、CLAUDE.md の雛形を作成します。最初に1回だけ実行しておくと、以後の会話で前提説明が不要になります。"
  },

  // ===== 便利な使い方（4択・4問） =====
  {
    id: 10,
    category: "tips",
    type: "choice",
    question: "大きな変更を始める前に「何をするつもりか」を先に提示させたい。使うべきモードは？",
    options: [
      "Preview mode",
      "Plan mode（Shift + Tab で切替）",
      "Dry-run mode",
      "Review mode"
    ],
    correct: 1,
    explanation: "Plan mode は Shift + Tab で切替でき、作業開始前に計画を提示して承認を求める動きになります。他のモード名は Claude Code には存在しません。"
  },
  {
    id: 11,
    category: "tips",
    type: "choice",
    question: "コードレビューや大量の調査を「メイン会話を汚さずに」別働隊に任せたい。使う仕組みは？",
    options: [
      "サブプロセス（OSの子プロセス）",
      "ワーカースレッド",
      "サブエージェント（subagent）",
      "新しいターミナルタブを開く"
    ],
    correct: 2,
    explanation: "サブエージェントは目的特化の別AIを呼び出す仕組みで、結果だけを受け取れるのでメイン会話の文脈が汚れません。プロセスやスレッドはOSの話で別物です。"
  },
  {
    id: 12,
    category: "tips",
    type: "choice",
    question: "最新のライブラリのドキュメントを踏まえて実装してほしい。Claude にネットを見せるには？",
    options: [
      "できない。古い知識で書いてもらうしかない",
      "WebSearch（検索）や WebFetch（URL取得）ツールを使わせる",
      "ブラウザのスクショを毎回貼り付ける",
      "VPNを接続するとネットに繋がる"
    ],
    correct: 1,
    explanation: "Claude Code には WebSearch と WebFetch が組み込まれており、検索やURL取得ができます。「最新の公式ドキュメントを参照して実装して」と伝えれば自発的に使います。"
  },
  {
    id: 13,
    category: "tips",
    type: "choice",
    question: "画像（エラー画面のスクショ等）を元に相談したい。やり方は？",
    options: [
      "画像は扱えないので文字で説明するしかない",
      "画像をクラウドにアップしてURLを渡すしかない",
      "画像ファイルをターミナルにドラッグ&ドロップ、またはクリップボードから貼り付ける",
      "PDF化してから添付する必要がある"
    ],
    correct: 2,
    explanation: "Claude Code は画像を直接読めます。ドラッグ&ドロップやペーストで画像を添付でき、エラー画面やUIデザインの相談に便利です。"
  },

  // ===== セキュリティ（4択・4問） =====
  {
    id: 14,
    category: "security",
    type: "choice",
    question: "許可プロンプトをすべて飛ばす起動オプションとして正しいのは？",
    options: [
      "--skip-confirm",
      "--auto-approve",
      "--no-prompt",
      "--dangerously-skip-permissions"
    ],
    correct: 3,
    explanation: "正解は --dangerously-skip-permissions。名前のとおり危険なので、信頼できる隔離環境（コンテナ等）以外では使わないのが原則です。似た名前のオプションは存在しません。"
  },
  {
    id: 15,
    category: "security",
    type: "choice",
    question: "誤ってAPIキーを含む .env の中身を Claude に渡してしまった。まず取るべき行動は？",
    options: [
      ".env をローカルから削除する",
      "コミット履歴から該当ファイルを消す（git filter-branch など）",
      "対象のAPIキー・トークンをすぐに無効化し、新しいキーを発行して差し替える",
      "今後気を付ける、として一旦様子を見る"
    ],
    correct: 2,
    explanation: "一度外に出た秘密情報は「取り消せない」前提で動くのが鉄則です。最優先は鍵のローテーション。履歴の書き換えや削除はあくまで補助で、無効化が最も効果的です。"
  },
  {
    id: 16,
    category: "security",
    type: "choice",
    question: "知らない人が作った GitHub リポジトリを Claude Code で開く時、最も警戒すべきリスクは？",
    options: [
      "ファイル数が多くて遅くなる",
      "CLAUDE.md や README に仕込まれた悪意ある指示（プロンプトインジェクション）でAIが乗っ取られる",
      "文字コードの違いで文字化けする",
      "ライセンスが明記されていないこと"
    ],
    correct: 1,
    explanation: "プロンプトインジェクションは外部リポジトリを開く最大のリスクです。「まず読むだけ」の状態で中身を確認し、不審な指示が無いか目視してから作業に入りましょう。"
  },
  {
    id: 17,
    category: "security",
    type: "choice",
    question: "特に実行前の確認を怠ってはいけない「取り返しがつきにくい」git 操作はどれ？",
    options: [
      "git status",
      "git fetch origin",
      "git diff --cached",
      "git push --force"
    ],
    correct: 3,
    explanation: "git push --force はリモートの履歴を上書きし、他人の作業を消しかねない破壊的操作です。status / fetch / diff は読み取り中心で破壊性は低めです。"
  },

  // ===== 設定・カスタマイズ（4択・3問） =====
  {
    id: 18,
    category: "settings",
    type: "choice",
    question: "「自分だけの設定」で、Git にもコミットしたくない設定を書くべきファイルは？",
    options: [
      "~/.claude/user.json",
      ".claude/private.json",
      ".claude/settings.local.json",
      ".claude/dev.json"
    ],
    correct: 2,
    explanation: ".claude/settings.local.json が個人用のローカル設定で、Claude Code が自動で読み込み、.gitignore 対象として扱われます。他の名前は一般的な命名ではなく、自動読込もされません。"
  },
  {
    id: 19,
    category: "settings",
    type: "choice",
    question: "「ファイル編集後に自動でフォーマッタを走らせる」のように、特定のタイミングに自動処理を挟む仕組みを何と呼ぶ？",
    options: [
      "Triggers",
      "Webhooks",
      "Listeners",
      "Hooks"
    ],
    correct: 3,
    explanation: "Claude Code のこの仕組みは Hooks と呼びます。PreToolUse / PostToolUse / SessionStart / Stop などのタイミングを指定して、シェルコマンドを実行できます。"
  },
  {
    id: 20,
    category: "settings",
    type: "choice",
    question: "GitHub操作やSlack投稿など、外部サービスと Claude を繋ぐための共通規格は？",
    options: [
      "REST API",
      "OAuth 2.0",
      "GraphQL",
      "MCP（Model Context Protocol）"
    ],
    correct: 3,
    explanation: "MCP は AI と外部ツールを繋ぐための共通プロトコルです。REST や GraphQL は汎用のAPI形式、OAuth は認可の仕組みで、MCP とは役割が違います。"
  },

  // ===== 入力式問題（10問） =====
  {
    id: 21,
    category: "basic",
    type: "input",
    question: "ターミナルで Claude Code の対話セッションを起動するコマンドを入力してください。",
    accepted: ["claude"],
    hint: "コマンド名のみ。オプションは不要。",
    explanation: "`claude` と入力するだけで起動します。作業対象のフォルダに `cd` で移動してから起動するのが基本です。"
  },
  {
    id: 22,
    category: "slash",
    type: "input",
    question: "現在の会話文脈をリセットするスラッシュコマンドを入力してください。",
    accepted: ["/clear"],
    hint: "スラッシュ「/」で始まります。",
    explanation: "`/clear` で会話履歴をクリアできます。話題が変わる時や、前の文脈に引きずられた応答が続く時に使います。"
  },
  {
    id: 23,
    category: "slash",
    type: "input",
    question: "プロジェクトを解析して CLAUDE.md を自動生成するスラッシュコマンドを入力してください。",
    accepted: ["/init"],
    hint: "スラッシュ「/」で始まる4文字。",
    explanation: "`/init` を実行すると、プロジェクト構成を分析してCLAUDE.mdの雛形を生成してくれます。最初の1回だけ実行するのが一般的です。"
  },
  {
    id: 24,
    category: "slash",
    type: "input",
    question: "トークン使用量と料金を表示するスラッシュコマンドを入力してください。",
    accepted: ["/cost"],
    hint: "スラッシュ「/」から始まる、英語の「費用」。",
    explanation: "`/cost` でセッション中のトークン使用量とおおよその料金が確認できます。長時間の作業時は定期的にチェックしましょう。"
  },
  {
    id: 25,
    category: "slash",
    type: "input",
    question: "過去の会話を選んで再開するスラッシュコマンドを入力してください。",
    accepted: ["/resume"],
    hint: "英語の「再開」。",
    explanation: "`/resume` で過去のセッション一覧が表示され、選んで続きから再開できます。起動時に `claude --resume` としても同じ動作になります。"
  },
  {
    id: 26,
    category: "slash",
    type: "input",
    question: "Claude Code を安全に終了するスラッシュコマンドを入力してください。",
    accepted: ["/exit", "/quit"],
    hint: "英語の「出る」。2種類どちらでも可。",
    explanation: "`/exit` または `/quit` で終了できます。Ctrl + D でも同様です。会話履歴は自動保存されるので `/resume` で再開可能です。"
  },
  {
    id: 27,
    category: "slash",
    type: "input",
    question: "会話を要約して文脈を圧縮するスラッシュコマンドを入力してください。",
    accepted: ["/compact"],
    hint: "英語の「コンパクトにする」。",
    explanation: "`/compact` は会話を要約して文脈を軽くします。長時間の作業で応答速度が落ちてきた時に有効です。"
  },
  {
    id: 28,
    category: "basic",
    type: "input",
    question: "会話で `src/app.js` というファイルを Claude に参照させたい。入力すべき記法は？",
    accepted: ["@src/app.js"],
    hint: "ファイルパスの先頭にある記号を付けます。",
    explanation: "`@` を先頭に付けると、そのパスのファイルを参照できます。入力中に候補が出るのでタイポを防げます。"
  },
  {
    id: 29,
    category: "slash",
    type: "input",
    question: "使用するモデル（Opus / Sonnet / Haiku 等）を切り替えるスラッシュコマンドを入力してください。",
    accepted: ["/model"],
    hint: "英語の「モデル」。",
    explanation: "`/model` で現在のモデル確認・変更ができます。難しい作業は賢いモデル、軽い作業は高速なモデルと使い分けると効率的です。"
  },
  {
    id: 30,
    category: "settings",
    type: "input",
    question: "npm を使って Claude Code をグローバルインストールするコマンドを入力してください。",
    accepted: [
      "npm install -g @anthropic-ai/claude-code",
      "npm i -g @anthropic-ai/claude-code"
    ],
    hint: "グローバルは `-g` オプション。パッケージ名は @anthropic-ai/claude-code",
    explanation: "`npm install -g @anthropic-ai/claude-code`（または省略形 `npm i -g ...`）でインストールできます。macOS で権限エラーが出る場合は `sudo` を付けるか、nvm で Node を管理すると解決しやすいです。"
  }
];
