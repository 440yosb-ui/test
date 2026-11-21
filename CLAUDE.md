# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Claude Code を非プログラマーが学習するための日本語クイズ Web アプリ。iPhone Safari での通勤スキマ時間利用を想定。4 択と入力式のクイズを 30 問収録。ビルド工程・外部依存なしの純粋な静的サイト（GitHub Pages で配信する想定）。

## 開発コマンド

ビルド・テスト・lint の仕組みはない。変更後は以下で最低限の確認を行う:

```bash
node --check app.js questions.js   # JS 構文チェック
python3 -m http.server 8000        # ローカルプレビュー（http://localhost:8000）
```

## アーキテクチャ

4 ファイル構成。SPA 風の単一ページで、4 画面を DOM に全部含めて `.active` クラスで切り替える。

- **`index.html`** — `#home-screen` / `#quiz-screen` / `#result-screen` / `#stats-screen` の 4 セクション。`showScreen(id)` で切替。
- **`style.css`** — CSS 変数でライト/ダーク対応、`env(safe-area-inset-*)` で iPhone のノッチ対応。
- **`questions.js`** — データのみ。グローバルに `CATEGORIES`（5 件）と `QUESTIONS`（30 件）を公開。
- **`app.js`** — IIFE でカプセル化。状態管理・DOM 更新・永続化を一手に担う。

### 問題データの 2 形式（`questions.js`）

```js
// 4択形式
{ id, category, type: "choice", question, options: [4つ], correct: 0-3, explanation }
// 入力形式
{ id, category, type: "input", question, accepted: [string, ...], hint, explanation }
```

`type` で `renderChoiceQuestion()` / `renderInputQuestion()` のどちらを呼ぶか分岐。入力型は `normalizeInput()`（前後空白削除＋連続空白を 1 つに）で正規化してから `accepted` 配列と照合するため、複数の正解パターン（例: `npm install -g ...` と `npm i -g ...`）を受け付け可能。

### 進捗の永続化（`app.js`）

localStorage キー: `claude-code-quiz-progress-v1`

```js
{ answers: { [questionId]: { correct, count } },
  wrongIds: [...],        // 復習モードの出題対象
  lastStudyDate: "YYYY-MM-DD",
  streak, totalAnswered, totalCorrect }
```

- 正解した問題 ID は `wrongIds` から自動的に削除される → 「間違えた問題を復習」モードはこれを出題源にする。
- `updateStreak()` は日付差分で +1 / リセット / 据え置きを判定。

### claude.ai 連携（`askOnClaudeAi` / `buildClaudePrompt`）

解説欄の「🤖 claude.aiで質問する」ボタンは、現在の問題・選択肢・正解・解説を日本語プロンプトに整形し、クリップボードにコピー → `claude.ai/new` を新タブで開く。**API コールは一切していない**（ユーザーの claude.ai 無料枠を使う無料運用）。クリップボード書き込みは `navigator.clipboard` → `document.execCommand('copy')` の順でフォールバック。

## 変更時の注意点

- **iOS Safari 固有**: `.code-input` の `font-size: 16px` は自動ズーム防止のため**下げない**。`viewport` の `user-scalable=no` と `viewport-fit=cover` も iPhone 用の設定。
- **問題追加**: `QUESTIONS` 配列に push するだけで良い（`id` は連番を維持）。画面側・ロジック側の変更は不要。
- **カテゴリ追加**: `CATEGORIES` に項目を追加するだけ。`color` フィールドの hex 値が UI にそのまま使われる（進捗バー・バッジ色など）。
- **UI 文言**: 対象は非プログラマー。技術用語は最小限にし、必要なら例え話を添える方針（既存問題の `explanation` を参照）。
- **コミットメッセージ**: 既存コミットは日本語。「概要 1 行 → 空行 → 詳細の箇条書き」のスタイルに揃える。

## 仕入れリサーチツール（`sedori/`）

クイズアプリとは独立した別ツール。Amazon 物販の仕入れ候補を絞り込む静的ページ（`sedori/index.html` / `style.css` / `app.js`、外部依存なし）。

- Keepa の Product Finder から書き出した CSV を読み込み、月の販売数・出品者数・価格などで絞り込む。列名は英語/日本語の両方を `FIELDS` のパターンで自動判定し、画面上で手動の割り当て変更も可能。
- 「仕入れ上限」= 販売価格 − 販売手数料 − FBA手数料 − その他経費 − 欲しい利益。
- 実際の Keepa 日本語エクスポート（167 列。`商品名` / `Buy Box: 現在` / `新品: 現在` / `Buy Box: 90 日平均` / `月間売上トレンド: 先月の購入` / `新品アイテム数: 現在` / `FBA Pick&Pack 料金` / `紹介料％` / `商品コード: EAN` など）で列の自動判定を確認済み。`Buy Box: 現在` は空欄が多いため `新品: 現在` で補い、計算用の販売価格は「いまの価格」と「90 日平均」の低いほうを使う。`Amazon: 現在` も空欄が多いため、`Buy Box: % Amazon 90 日` が 30% 以上なら Amazon 本体ありとみなす。型式欄は検索に使えない値が多く、`usableModel()` で選別する。
- リサーチの手法を切り替えられる（`app.js` の `MODES` と `EVAL`）: 通常／値上がり／トレンド／刈り取り／即刈り／セラー／クーポン。手法ごとに条件の初期値（`params`）、計算に使う販売価格、商品名の下に出す見どころ（`it.lines`）、並び順の点数（`it.score`）が変わる。条件の初期値と「Keepaに入れる検索条件」は利用者のドライブの資料（YouTube 文字起こし）に合わせた。クーポンだけは資料に具体的な条件が無く、一般的な考え方で作った。手法ごとの条件は `settings.modeParams[手法キー]` に保存。
- 値上がり率は Keepa の「下落％」列の符号を逆にして使い、列が無ければ「新品: 現在」と期間平均から計算する。手法に必要な列がファイルに無いときは `#mode-warn` に案内を出す（必須の列が無ければ 0 件、補助の列が無ければその条件だけ外す）。**下落％・在庫切れ率(OOS)・ランキング・クーポンの日本語の列名は推測で、実際の Keepa ファイルでは未確認**（違っていたら `FIELDS` のパターンを直す。画面の「列の割り当て」でも選べる）。
- どの手法でも共通: 出品者の数が 30 日平均から 3 割以上かつ 2 人以上増減したら注意書きを出す（`sellerTrend()`）。「出品者が増えている商品を除く」（初期値オン）と「月の販売数が分からない商品も表示する」（初期値オフ）の設定あり。根拠は合宿スライド 4 コマ目。「自己配送で売る場合の仕入れ上限も表示する」（初期値オフ、送料の初期値 200 円）をオンにすると、FBA 手数料の代わりに送料で計算した `it.limitSelf` を出し、FBA では赤字でも自己配送で利益が残る商品も残す。根拠はリベ大「自己配送 始め方 マニュアル」。
- **資料からの更新**: 利用者はドライブの「せどり資料」フォルダに資料を追加していき、それに合わせてツールを更新する方針（毎日の定期作業あり）。どのファイルを読んで何を反映したかは `sedori/SOURCES.md` に記録する。新しい資料を反映するときは、まずこの表に無いファイル・更新日時が新しいファイルだけを読み、反映後に表へ追記する。資料に根拠のない数字や手法は足さない。**リベ大（リベシティ）の資料を最優先**にし、ほかの資料と食い違うときはリベ大に合わせる（見分け方は SOURCES.md）。
- 各行に Google（型式で検索）・楽天・Yahoo!・Keepa へのリンクボタンを表示。
- 楽天/Yahoo! の最安値取得は、利用者が画面で入力した ID を使ってブラウザから直接問い合わせる。ID は localStorage（`sedori-research-settings-v1`）にのみ保存し、**リポジトリには絶対に書かない**。実際の ID での動作は未確認（Yahoo! はブラウザから直接つなげない可能性あり）。
- 出品チェック: 商品(ASIN)ごとに「出品できる/申請で通った/書類が必要/不可」を記録し、メーカー別に集計する。保存先は localStorage（`sedori-listing-checks-v1`）。JSON ファイルでのバックアップ/復元あり（復元は既存の記録を上書きせず追加のみ）。
- **スマホ（iPhone）操作が前提**。幅 760px 以下では表をカード表示に切り替える。ボタンは 44px 以上の高さを保つ。
- 利益管理（`sedori/kanri.html` / `kanri.js`、`style.css` は共用）: 仕入れ（1回の購入単位）と、それに結びつく売上を記録し、利益・在庫を集計する。保存先は localStorage（`sedori-ledger-v1`、`{ purchases: [...], sales: [...] }`）。1個あたり仕入れ額 = 仕入れ値 + 経費合計 ÷ 個数。CSV 書き出し（確定申告の元資料用）と JSON バックアップ/復元（復元は全置き換え、確認あり）。リサーチ画面の「仕入れを記録」は `kanri.html?add=1&...` で商品情報を引き継ぐ。Amazon の売上ファイル取り込みは未実装。
- 確認: `node --check sedori/app.js sedori/kanri.js`
