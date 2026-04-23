// Claude Code 学習クイズ - アプリロジック
(function () {
  'use strict';

  const STORAGE_KEY = 'claude-code-quiz-progress-v1';
  const SESSION_SIZE = 10; // ランダム出題1セットの問題数

  // ---- 進捗データ ----
  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultProgress();
      const p = JSON.parse(raw);
      return Object.assign(defaultProgress(), p);
    } catch (e) {
      return defaultProgress();
    }
  }

  function defaultProgress() {
    return {
      answers: {},        // { [questionId]: { correct: bool, count: number } }
      wrongIds: [],       // 間違えた問題ID（重複なし）
      lastStudyDate: null,
      streak: 0,
      totalAnswered: 0,
      totalCorrect: 0
    };
  }

  function saveProgress(p) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  }

  function updateStreak(p) {
    const today = new Date().toISOString().slice(0, 10);
    if (p.lastStudyDate === today) return;
    if (p.lastStudyDate) {
      const prev = new Date(p.lastStudyDate);
      const diffDays = Math.floor((new Date(today) - prev) / 86400000);
      if (diffDays === 1) p.streak += 1;
      else if (diffDays > 1) p.streak = 1;
      else p.streak = Math.max(1, p.streak);
    } else {
      p.streak = 1;
    }
    p.lastStudyDate = today;
  }

  // ---- 状態 ----
  let progress = loadProgress();
  let session = null; // { questions: [], index, correctCount }

  // ---- 画面遷移 ----
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    window.scrollTo(0, 0);
  }

  // ---- ユーティリティ ----
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function categoryById(id) {
    return CATEGORIES.find(c => c.id === id);
  }

  function questionsByCategory(catId) {
    return QUESTIONS.filter(q => q.category === catId);
  }

  // ---- ホーム画面の描画 ----
  function renderHome() {
    document.getElementById('stat-total').textContent = progress.totalAnswered;
    const acc = progress.totalAnswered > 0
      ? Math.round((progress.totalCorrect / progress.totalAnswered) * 100) + '%'
      : '–';
    document.getElementById('stat-accuracy').textContent = acc;
    document.getElementById('stat-streak').textContent = progress.streak;

    document.getElementById('review-count').textContent = progress.wrongIds.length + '問';
    document.getElementById('btn-review').disabled = progress.wrongIds.length === 0;
    document.getElementById('btn-review').style.opacity = progress.wrongIds.length === 0 ? 0.5 : 1;

    const list = document.getElementById('category-list');
    list.innerHTML = '';
    CATEGORIES.forEach(cat => {
      const qs = questionsByCategory(cat.id);
      const answered = qs.filter(q => progress.answers[q.id]).length;
      const pct = qs.length > 0 ? Math.round((answered / qs.length) * 100) : 0;

      const btn = document.createElement('button');
      btn.className = 'category-item';
      btn.innerHTML = `
        <div class="category-icon" style="background:${cat.color}22;color:${cat.color}">${cat.icon}</div>
        <div class="category-info">
          <div class="category-name">${cat.name}</div>
          <div class="category-progress">
            <div class="category-progress-bar"><div class="category-progress-fill" style="width:${pct}%;background:${cat.color}"></div></div>
            <span>${answered} / ${qs.length}</span>
          </div>
        </div>
        <div class="category-arrow">›</div>
      `;
      btn.addEventListener('click', () => startSession(qs, cat.name));
      list.appendChild(btn);
    });
  }

  // ---- セッション開始 ----
  function startSession(questions, label) {
    if (!questions || questions.length === 0) return;
    const shuffled = shuffle(questions).slice(0, Math.min(SESSION_SIZE, questions.length));
    session = {
      questions: shuffled,
      index: 0,
      correctCount: 0,
      label: label || ''
    };
    renderQuestion();
    showScreen('quiz-screen');
  }

  function startRandom() {
    startSession(QUESTIONS, 'ランダム');
  }

  function startReview() {
    const qs = QUESTIONS.filter(q => progress.wrongIds.includes(q.id));
    if (qs.length === 0) return;
    startSession(qs, '復習');
  }

  // ---- 入力正規化（前後空白削除・連続空白を1つに） ----
  function normalizeInput(s) {
    return String(s || '').trim().replace(/\s+/g, ' ');
  }

  // ---- 問題画面の描画 ----
  function renderQuestion() {
    const q = session.questions[session.index];
    const cat = categoryById(q.category);

    document.getElementById('quiz-category').textContent = cat ? cat.name : '';
    document.getElementById('quiz-category').style.background = cat ? cat.color : '';
    document.getElementById('question-text').textContent = q.question;

    const pct = ((session.index) / session.questions.length) * 100;
    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('progress-text').textContent = (session.index + 1) + ' / ' + session.questions.length;

    const optsEl = document.getElementById('options');
    optsEl.innerHTML = '';

    if (q.type === 'input') {
      renderInputQuestion(q, optsEl);
    } else {
      renderChoiceQuestion(q, optsEl);
    }

    document.getElementById('quiz-feedback').classList.remove('show');
  }

  // ---- 4択の描画 ----
  function renderChoiceQuestion(q, optsEl) {
    const labels = ['A', 'B', 'C', 'D'];
    q.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'option';
      btn.innerHTML = `<span class="option-label">${labels[i]}</span><span class="option-text">${opt}</span>`;
      btn.addEventListener('click', () => selectOption(i, btn));
      optsEl.appendChild(btn);
    });
  }

  // ---- 入力式の描画 ----
  function renderInputQuestion(q, optsEl) {
    const wrapper = document.createElement('div');
    wrapper.className = 'input-wrapper';

    const hint = document.createElement('div');
    hint.className = 'input-hint';
    hint.textContent = q.hint ? '💬 ヒント: ' + q.hint : '';
    if (q.hint) wrapper.appendChild(hint);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'code-input';
    input.placeholder = 'ここに入力...';
    input.autocomplete = 'off';
    input.autocapitalize = 'none';
    input.spellcheck = false;
    wrapper.appendChild(input);

    const submit = document.createElement('button');
    submit.className = 'btn btn-primary';
    submit.textContent = '答え合わせ';
    submit.addEventListener('click', () => submitInput(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitInput(input.value);
      }
    });
    wrapper.appendChild(submit);

    optsEl.appendChild(wrapper);
    setTimeout(() => input.focus(), 50);
  }

  // ---- 入力式の回答判定 ----
  function submitInput(value) {
    const q = session.questions[session.index];
    const user = normalizeInput(value);
    if (!user) return; // 空回答は無視
    const accepted = (q.accepted || []).map(normalizeInput);
    const isCorrect = accepted.includes(user);

    // 入力欄を無効化
    const input = document.querySelector('.code-input');
    const btn = document.querySelector('.input-wrapper .btn');
    if (input) {
      input.disabled = true;
      input.classList.add(isCorrect ? 'correct' : 'wrong');
    }
    if (btn) btn.disabled = true;

    recordAnswer(q, isCorrect);

    // フィードバック（正解例を解説に添える）
    const extra = isCorrect
      ? ''
      : '\n\n正解例: ' + (q.accepted[0] || '');
    showFeedback(isCorrect, q.explanation + extra);
  }

  // ---- 4択の回答判定 ----
  function selectOption(selectedIndex, buttonEl) {
    const q = session.questions[session.index];
    const isCorrect = selectedIndex === q.correct;

    const optionButtons = document.querySelectorAll('#options .option');
    optionButtons.forEach((btn, i) => {
      btn.classList.add('disabled');
      if (i === q.correct) btn.classList.add('correct');
      else if (i === selectedIndex) btn.classList.add('wrong');
    });

    recordAnswer(q, isCorrect);
    showFeedback(isCorrect, q.explanation);
  }

  // ---- 進捗に記録 ----
  function recordAnswer(q, isCorrect) {
    const prev = progress.answers[q.id];
    progress.answers[q.id] = {
      correct: isCorrect,
      count: (prev ? prev.count : 0) + 1
    };
    progress.totalAnswered += 1;
    if (isCorrect) progress.totalCorrect += 1;

    if (isCorrect) {
      progress.wrongIds = progress.wrongIds.filter(id => id !== q.id);
      session.correctCount += 1;
    } else {
      if (!progress.wrongIds.includes(q.id)) progress.wrongIds.push(q.id);
    }

    updateStreak(progress);
    saveProgress(progress);

    const pct = ((session.index + 1) / session.questions.length) * 100;
    document.getElementById('progress-fill').style.width = pct + '%';
  }

  // ---- フィードバック表示 ----
  function showFeedback(isCorrect, explanationText) {
    const fb = document.getElementById('quiz-feedback');
    const title = document.getElementById('feedback-title');
    const icon = document.getElementById('feedback-icon');
    title.classList.remove('correct', 'wrong');
    if (isCorrect) {
      title.textContent = '正解！';
      title.classList.add('correct');
      icon.textContent = '✅';
    } else {
      title.textContent = '惜しい！';
      title.classList.add('wrong');
      icon.textContent = '💡';
    }
    document.getElementById('feedback-explanation').textContent = explanationText;

    const nextBtn = document.getElementById('btn-next');
    nextBtn.textContent = (session.index + 1 >= session.questions.length) ? '結果を見る' : '次の問題へ';
    fb.classList.add('show');
    fb.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  // ---- 次の問題 or 結果へ ----
  function goNext() {
    session.index += 1;
    if (session.index >= session.questions.length) {
      showResult();
    } else {
      renderQuestion();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // ---- 結果画面 ----
  function showResult() {
    const total = session.questions.length;
    const correct = session.correctCount;
    const pct = Math.round((correct / total) * 100);

    document.getElementById('result-correct').textContent = correct;
    document.getElementById('result-total').textContent = total;
    document.getElementById('result-percent').textContent = pct + '%';

    const emoji = document.getElementById('result-emoji');
    const title = document.getElementById('result-title');
    const msg = document.getElementById('result-message');

    if (pct === 100) {
      emoji.textContent = '🏆';
      title.textContent = '全問正解！';
      msg.textContent = '素晴らしいです！この調子で他のカテゴリにも挑戦してみましょう。';
    } else if (pct >= 80) {
      emoji.textContent = '🎉';
      title.textContent = 'すごい！';
      msg.textContent = 'よく理解できています。間違えた問題は「復習」から見返せます。';
    } else if (pct >= 50) {
      emoji.textContent = '👍';
      title.textContent = 'いい感じ';
      msg.textContent = '半分以上クリア。解説をじっくり読んで、もう一度挑戦してみましょう。';
    } else {
      emoji.textContent = '📚';
      title.textContent = 'これから伸びます';
      msg.textContent = '最初はみんなこんな感じです。解説を読めば少しずつ定着します。';
    }

    showScreen('result-screen');
  }

  // ---- 進捗詳細画面 ----
  function renderStats() {
    document.getElementById('detail-answered').textContent = progress.totalAnswered;
    document.getElementById('detail-correct').textContent = progress.totalCorrect;
    const acc = progress.totalAnswered > 0
      ? Math.round((progress.totalCorrect / progress.totalAnswered) * 100) + '%'
      : '–';
    document.getElementById('detail-accuracy').textContent = acc;

    const container = document.getElementById('category-stats');
    container.innerHTML = '';
    CATEGORIES.forEach(cat => {
      const qs = questionsByCategory(cat.id);
      let answered = 0, correct = 0;
      qs.forEach(q => {
        const a = progress.answers[q.id];
        if (a) {
          answered += 1;
          if (a.correct) correct += 1;
        }
      });
      const pct = answered > 0 ? Math.round((correct / answered) * 100) : 0;
      const row = document.createElement('div');
      row.className = 'category-stat-row';
      row.innerHTML = `
        <div class="category-name">
          <span>${cat.icon} ${cat.name}</span>
          <span class="category-stat-pct" style="color:${cat.color}">${answered > 0 ? pct + '%' : '–'}</span>
        </div>
        <div class="category-progress-bar"><div class="category-progress-fill" style="width:${answered > 0 ? pct : 0}%;background:${cat.color}"></div></div>
        <div class="category-stat-detail">${answered} / ${qs.length} 問を解答 ・ 正解 ${correct} 問</div>
      `;
      container.appendChild(row);
    });
  }

  // ---- イベントバインド ----
  function bindEvents() {
    document.getElementById('btn-random').addEventListener('click', startRandom);
    document.getElementById('btn-review').addEventListener('click', startReview);
    document.getElementById('btn-back').addEventListener('click', () => {
      if (confirm('クイズを中断しますか？（進捗は保存されます）')) {
        renderHome();
        showScreen('home-screen');
      }
    });
    document.getElementById('btn-next').addEventListener('click', goNext);
    document.getElementById('btn-again').addEventListener('click', () => {
      startSession(QUESTIONS, 'ランダム');
    });
    document.getElementById('btn-home').addEventListener('click', () => {
      renderHome();
      showScreen('home-screen');
    });
    document.getElementById('btn-stats').addEventListener('click', () => {
      renderStats();
      showScreen('stats-screen');
    });
    document.getElementById('btn-stats-back').addEventListener('click', () => {
      renderHome();
      showScreen('home-screen');
    });
    document.getElementById('btn-reset').addEventListener('click', () => {
      if (confirm('すべての進捗をリセットします。よろしいですか？')) {
        localStorage.removeItem(STORAGE_KEY);
        progress = loadProgress();
        renderHome();
      }
    });
  }

  // ---- 起動 ----
  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    renderHome();
    showScreen('home-screen');
  });
})();
