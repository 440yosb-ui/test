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
