(() => {
  let currentMode = '';      
  let kukuSubMode = 'single'; // 'single' または 'mixed'
  let selectedDans = [];     // 複数選択用
  let currentIndex = 0;      
  let totalQuestions = 0;    
  let correctCount = 0;
  let startTimeMs = null;
  let inputLocked = false;
  let inputBuffer = [];
  let currentQuestionData = { q: '', a: 0 };
  let lastQuestionKey = ""; // 同じ問題防止用
  let customQuestionCount = 10;

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

  const getRank = (ms, totalQ) => {
    // 1問あたりの平均秒数を計算
    const averageSec = (ms / 1000) / totalQ;

    // 1問あたり何秒で解いたかで判定
    if (averageSec < 1.8) return "ランクSS: まるでサイボーグ ⚡️";
    if (averageSec < 2.7) return "ランクS: さんすう にんじゃ 🥷";
    if (averageSec < 4.4) return "ランクA: そろばんの まじゅつし 🪄";
    if (averageSec < 6.6) return "ランクB: てんさい にんげん 💡";
    if (averageSec < 10.0) return "ランクC: ふつうの にんげん 🧐";
    return "ランクD: ひが くれちゃうよ～";
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

  // 問題作成ロジック
  const generateQuestion = () => {
    let qObj = { q: '', a: 0, key: '' };
    
    while (true) {
      if (currentMode === 'kuku') {
        let left, right;
        if (kukuSubMode === 'single') {
          left = selectedDans[0];
          right = currentIndex + 1; // 1~9の順番
        } else {
          left = selectedDans[Math.floor(Math.random() * selectedDans.length)];
          right = Math.floor(Math.random() * 8) + 2; // 2~9
        }
        qObj.q = `${left} × ${right} = ?`;
        qObj.a = left * right;
        qObj.key = `${left}x${right}`;
      } else {
        const target = currentMode === 'add5' ? 5 : 10;
        const first = Math.floor(Math.random() * (target - 1)) + 1;
        qObj.q = `${first} + □ = ${target}`;
        qObj.a = target - first;
        qObj.key = `${first}+${target}`;
      }

      // 同じ問題が連続しないようにチェック（九九の「ひとつずつ」モード以外）
      if (kukuSubMode === 'single' && currentMode === 'kuku') break;
      if (qObj.key !== lastQuestionKey) break;
    }
    
    lastQuestionKey = qObj.key;
    return qObj;
  };

// スライダーのイベント（設定部分に追加）
const slider = document.getElementById('kuku-count-slider');
const display = document.getElementById('kuku-count-display');
slider.addEventListener('input', (e) => {
  customQuestionCount = parseInt(e.target.value);
  display.textContent = customQuestionCount;
});

// startQuiz 関数を修正
const startQuiz = () => {
  currentIndex = 0; 
  correctCount = 0; 
  lastQuestionKey = "";
  
  // 問題数を決定
  if (currentMode === 'kuku') {
    totalQuestions = (kukuSubMode === 'single') ? 9 : customQuestionCount;
  } else {
    totalQuestions = 10; // あわせていくつは10問固定
  }
  
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
        // ここを修正：経過時間(elapsed)と、合計問題数(totalQuestions)を渡す
        labels.resultRank.textContent = getRank(elapsed, totalQuestions);
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
    
    let modeName = "";
    if (currentMode === 'kuku') {
      modeName = kukuSubMode === 'single' ? `${selectedDans[0]}のだん` : "くく（まぜまぜ）";
    } else {
      modeName = currentMode === 'add5' ? 'あわせて5' : 'あわせて10';
    }
    labels.quizMode.textContent = modeName;
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

  // --- イベント設定 ---

  // 九九メニューの状態を更新する関数
const updateKukuMenu = () => {
  selectedDans = [];
  document.querySelectorAll('.dan-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('btn-kuku-start').disabled = true;
  
  const guideText = document.getElementById('kuku-guide-text');
  const countSetting = document.getElementById('kuku-count-setting'); // 追加
  
  if (kukuSubMode === 'single') {
    guideText.textContent = "だんを えらぼう";
    labels.dan.textContent = "だんを えらんでね";
    countSetting.classList.add('hidden'); // ひとつずつモードでは隠す
  } else {
    guideText.textContent = "だんを えらぼう（いくつでも OK！）";
    labels.dan.textContent = "だんを えらぼう（複数選択可）";
    countSetting.classList.remove('hidden'); // まぜまぜモードで表示
  }
};

  // タブ切り替えイベント
  document.getElementById('tab-kuku-single').addEventListener('click', (e) => {
    kukuSubMode = 'single';
    document.getElementById('tab-kuku-mixed').classList.remove('active');
    document.getElementById('tab-kuku-single').classList.add('active');
    updateKukuMenu();
  });

  document.getElementById('tab-kuku-mixed').addEventListener('click', (e) => {
    kukuSubMode = 'mixed';
    document.getElementById('tab-kuku-single').classList.remove('active');
    document.getElementById('tab-kuku-mixed').classList.add('active');
    updateKukuMenu();
  });

  // 段ボタンクリック
  document.querySelectorAll('.dan-btn').forEach(btn => btn.addEventListener('click', () => {
    const dan = parseInt(btn.dataset.dan);
    if (kukuSubMode === 'single') {
      selectedDans = [dan];
      document.querySelectorAll('.dan-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    } else {
      if (selectedDans.includes(dan)) {
        selectedDans = selectedDans.filter(d => d !== dan);
        btn.classList.remove('active');
      } else {
        selectedDans.push(dan);
        btn.classList.add('active');
      }
    }
    
    const startBtn = document.getElementById('btn-kuku-start');
    if (selectedDans.length > 0) {
      labels.dan.textContent = selectedDans.sort().join(', ') + " のだん";
      startBtn.disabled = false;
    } else {
      labels.dan.textContent = "だんを えらんでね";
      startBtn.disabled = true;
    }
    setTimeout(() => startBtn.blur(), 10);
  }));

  // キーボード・その他
  document.addEventListener('keydown', (e) => {
    if (views.quiz.classList.contains('active')) {
      if (e.key >= '0' && e.key <= '9') handleInput(e.key);
      if (e.key === 'Backspace') { inputBuffer.pop(); renderSlots(); }
    }
    if (e.key === 'Enter') {
      if (views.result.classList.contains('active')) showView('main');
      else if (views.kuku.classList.contains('active')) {
        const b = document.getElementById('btn-kuku-start');
        if (!b.disabled) { currentMode = 'kuku'; runCountdown(startQuiz); }
      }
    }
  });

  document.querySelectorAll('.menu-large-btn').forEach(b => b.addEventListener('click', () => showView(b.dataset.modeType === 'kuku' ? 'kuku' : 'addition')));
  document.getElementById('btn-kuku-start').addEventListener('click', () => { currentMode = 'kuku'; runCountdown(startQuiz); });
  document.querySelectorAll('.mode-btn').forEach(b => b.addEventListener('click', () => { currentMode = b.dataset.addMode === '5' ? 'add5' : 'add10'; runCountdown(startQuiz); }));
  document.querySelectorAll('.btn-back-to-main, #btn-quick-menu, #btn-back-to-menu').forEach(b => b.addEventListener('click', () => {
    updateKukuMenu(); // リセット
    showView('main');
  }));
  document.querySelectorAll('.key[data-digit]').forEach(b => b.addEventListener('click', () => handleInput(b.dataset.digit)));
  document.querySelector('[data-action="backspace"]').addEventListener('click', () => { inputBuffer.pop(); renderSlots(); });

  // ズーム対策
  document.addEventListener('touchstart', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
  
})();