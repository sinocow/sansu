(() => {
  // --- 基本設定などはそのまま ---
  let currentMode = '';      
  let selectedDan = null;    
  let currentIndex = 0;      
  let totalQuestions = 0;    
  let correctCount = 0;
  let startTimeMs = null;
  let inputLocked = false;
  let inputBuffer = [];
  let currentQuestionData = { q: '', a: 0 };

  const views = {
    main: document.getElementById('view-main-menu'),
    kuku: document.getElementById('view-kuku-menu'),
    addition: document.getElementById('view-addition-menu'),
    quiz: document.getElementById('view-quiz'),
    result: document.getElementById('view-result')
  };

  const labels = {
    dan: document.getElementById('selected-dan-label'),
    quizMode: document.getElementById('quiz-mode-label'),
    quizProgress: document.getElementById('quiz-progress'),
    quizQuestion: document.getElementById('quiz-question'),
    resultSummary: document.getElementById('result-summary'),
    resultTime: document.getElementById('result-time'),
    resultCongrats: document.getElementById('result-congrats'),
    resultRank: document.getElementById('result-rank')
  };

  const overlay = { bg: document.getElementById('countdown-overlay'), num: document.getElementById('countdown-number') };
  const slotsContainer = document.getElementById('answer-slots');
  const judgeEl = document.getElementById('judge');

  const getRank = (ms) => {
    const sec = ms / 1000;
    if (sec < 15) return "しんそくの でんたくサイボーグ ⚡️";
    if (sec < 25) return "ばくそくの さんすうにんじゃ 🥷";
    if (sec < 40) return "そろばんの まじゅつし 🪄";
    if (sec < 60) return "ひらめき てんさいにんげん 💡";
    if (sec < 90) return "じっくり かんがえる てつがくしゃ 🧐";
    return "うちゅうの しんりを探求する者 🌌";
  };

  const showView = (viewKey) => {
    Object.values(views).forEach(v => v.classList.remove('active'));
    views[viewKey].classList.add('active');
  };

  const runCountdown = (callback) => {
    let count = 3;
    overlay.num.textContent = count;
    overlay.bg.classList.remove('hidden');
    const timer = setInterval(() => {
      count--;
      if (count > 0) overlay.num.textContent = count;
      else { clearInterval(timer); overlay.bg.classList.add('hidden'); callback(); }
    }, 800);
  };

  const generateQuestion = () => {
    if (currentMode === 'kuku') {
      const mult = currentIndex + 1;
      return { q: `${selectedDan} × ${mult} = ?`, a: selectedDan * mult };
    } else {
      const target = currentMode === 'add5' ? 5 : 10;
      const first = Math.floor(Math.random() * (target - 1)) + 1;
      return { q: `${first} + □ = ${target}`, a: target - first };
    }
  };

  const startQuiz = () => {
    currentIndex = 0; correctCount = 0;
    totalQuestions = currentMode === 'kuku' ? 9 : 10;
    showView('quiz');
    startTimeMs = Date.now();
    nextQuestion();
  };

  const nextQuestion = () => {
    if (currentIndex >= totalQuestions) {
      const elapsed = Date.now() - startTimeMs;
      labels.resultSummary.textContent = `${totalQuestions}もん中 ${correctCount}もん せいかい！`;
      labels.resultTime.textContent = `タイム: ${Math.floor(elapsed/1000)}びょう`;
      const isPerfect = (correctCount === totalQuestions);
      labels.resultCongrats.classList.toggle('hidden', !isPerfect);
      if (isPerfect) {
        labels.resultRank.textContent = getRank(elapsed);
        labels.resultRank.style.color = "var(--accent)";
      } else {
        labels.resultRank.textContent = "ぜんもんせいかいで ランクが でるよ！";
        labels.resultRank.style.color = "var(--muted)";
      }
      showView('result');
      return;
    }
    currentQuestionData = generateQuestion();
    inputBuffer = []; inputLocked = false;
    labels.quizProgress.textContent = `${currentIndex + 1}/${totalQuestions}`;
    labels.quizQuestion.textContent = currentQuestionData.q;
    labels.quizMode.textContent = currentMode === 'kuku' ? `${selectedDan}のだん` : (currentMode === 'add5' ? 'あわせて5' : 'あわせて10');
    renderSlots();
  };

  const renderSlots = () => {
    const len = String(currentQuestionData.a).length;
    slotsContainer.innerHTML = '';
    for (let i = 0; i < len; i++) {
      const s = document.createElement('div');
      s.className = 'slot' + (inputBuffer[i] !== undefined ? ' filled' : '');
      s.textContent = inputBuffer[i] ?? '';
      slotsContainer.appendChild(s);
    }
  };

  const handleInput = (digit) => {
    if (inputLocked) return;
    const len = String(currentQuestionData.a).length;
    if (inputBuffer.length < len) { inputBuffer.push(digit); renderSlots(); }
    if (inputBuffer.length === len) {
      inputLocked = true;
      const isOk = parseInt(inputBuffer.join(''), 10) === currentQuestionData.a;
      if (isOk) correctCount++;
      judgeEl.textContent = isOk ? '〇' : '×';
      judgeEl.className = `judge show ${isOk ? 'ok' : 'ng'}`;
      setTimeout(() => { judgeEl.classList.remove('show'); currentIndex++; nextQuestion(); }, 400);
    }
  };

  // --- キーボード入力のイベントリスナー ---
  document.addEventListener('keydown', (e) => {
    // 1. クイズ中の数字入力
    if (views.quiz.classList.contains('active')) {
      if (e.key >= '0' && e.key <= '9') {
        handleInput(e.key);
      }
      if (e.key === 'Backspace') {
        inputBuffer.pop();
        renderSlots();
      }
    }

    // 2. エンターキーの挙動
    if (e.key === 'Enter') {
      // 結果画面ならメニューに戻る
      if (views.result.classList.contains('active')) {
        showView('main');
      }
      // 九九の段選択中、スタートボタンが有効なら開始
      else if (views.kuku.classList.contains('active')) {
        const startBtn = document.getElementById('btn-kuku-start');
        if (!startBtn.disabled) {
          currentMode = 'kuku';
          runCountdown(startQuiz);
        }
      }
    }
  });

  // --- ボタンクリックのイベント ---
  document.querySelectorAll('.menu-large-btn').forEach(b => b.addEventListener('click', () => showView(b.dataset.modeType === 'kuku' ? 'kuku' : 'addition')));
  document.querySelectorAll('.dan-btn').forEach(b => b.addEventListener('click', () => {
    selectedDan = parseInt(b.dataset.dan);
    document.querySelectorAll('.dan-btn').forEach(btn => btn.classList.remove('active'));
    b.classList.add('active');
    labels.dan.textContent = `${selectedDan}のだん`;
    document.getElementById('btn-kuku-start').disabled = false;
    setTimeout(() => {
      startBtn.blur();
    }, 10);
  }));
  document.getElementById('btn-kuku-start').addEventListener('click', () => { currentMode = 'kuku'; runCountdown(startQuiz); });
  document.querySelectorAll('.mode-btn').forEach(b => b.addEventListener('click', () => { currentMode = b.dataset.addMode === '5' ? 'add5' : 'add10'; runCountdown(startQuiz); }));
  document.querySelectorAll('.btn-back-to-main, #btn-quick-menu, #btn-back-to-menu').forEach(b => b.addEventListener('click', () => showView('main')));
  document.querySelectorAll('.key[data-digit]').forEach(b => b.addEventListener('click', () => handleInput(b.dataset.digit)));
  document.querySelector('[data-action="backspace"]').addEventListener('click', () => { inputBuffer.pop(); renderSlots(); });

  // iPhone Safariのダブルタップズームを強制的に禁止する
document.addEventListener('touchstart', (e) => {
  if (e.touches.length > 1) {
    e.preventDefault(); // 2本指以上の操作（ピンチズーム）を禁止
  }
}, { passive: false });

let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = (new Date()).getTime();
  if (now - lastTouchEnd <= 300) {
    e.preventDefault(); // 0.3秒以内の連続タップ（ダブルタップズーム）を禁止
  }
  lastTouchEnd = now;
}, false);
})();