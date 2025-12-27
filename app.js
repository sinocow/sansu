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
  let questionHistory = {}; // 出題履歴を保存するオブジェクト
  let mistakes = [];

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

  const generateQuestion = () => {
    // 1. 全候補リストを作成
    let pool = [];
    if (currentMode === 'kuku') {
      if (kukuSubMode === 'single') {
        // 「ひとつずつ」は順番通りなので確率制御不要
        const mult = currentIndex + 1;
        return { q: `${selectedDans[0]} × ${mult} = ?`, a: selectedDans[0] * mult, key: `kuku_${selectedDans[0]}x${mult}` };
      }
      // まぜまぜモード用の全候補
      selectedDans.forEach(d => {
        for (let r = 2; r <= 9; r++) pool.push({ l: d, r: r, key: `kuku_${d}x${r}` });
      });
    } else {
      const target = currentMode === 'add5' ? 5 : 10;
      for (let i = 1; i < target; i++) pool.push({ l: i, r: target, key: `add_${target}_${i}` });
    }

    // 2. 確率（重み）に基づいた抽選
    // 初期重みは 100 とし、出題回数ごとに 80% ずつ減衰させる
    let totalWeight = 0;
    const weightedPool = pool.map(item => {
      const count = questionHistory[item.key] || 0;
      // 重み計算：100 * (0.2の累乗) -> 100, 20, 4, 0.8... と激減させる
      const weight = Math.pow(0.2, count) * 100;
      
      // 直前と同じ問題は重みを強制的に 0 にして連続を避ける
      const finalWeight = (item.key === lastQuestionKey) ? 0 : weight;
      totalWeight += finalWeight;
      return { ...item, weight: totalWeight };
    });

    // 3. 抽選実行
    const random = Math.random() * totalWeight;
    const selected = weightedPool.find(item => item.weight >= random);

    // 4. 結果の整形と履歴保存
    const result = currentMode === 'kuku' 
      ? { q: `${selected.l} × ${selected.r} = ?`, a: selected.l * selected.r, key: selected.key }
      : { q: `${selected.l} + □ = ${selected.r}`, a: selected.r - selected.l, key: selected.key };

    questionHistory[selected.key] = (questionHistory[selected.key] || 0) + 1;
    lastQuestionKey = selected.key;
    
    return result;
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
  mistakes = [];
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
      
      // ★正解率85%以上か判定
      const accuracy = correctCount / totalQuestions;
      const isGoodAccuracy = accuracy >= 0.85;
      
      labels.resultCongrats.classList.toggle('hidden', accuracy < 1.0); // 100%の時だけ「ぜんもんせいかい」表示
      
      if (isGoodAccuracy) {
        labels.resultRank.textContent = getRank(elapsed, totalQuestions);
        labels.resultRank.style.color = "var(--accent)";
      } else {
        labels.resultRank.textContent = "もっと せいかいすると ランクが でるよ！";
        labels.resultRank.style.color = "var(--muted)";
      }

      // ★間違えたリストの表示
      const mistakeContainer = document.getElementById('mistake-container');
      const mistakeList = document.getElementById('mistake-list');
      mistakeList.innerHTML = ''; // クリア

      if (mistakes.length > 0) {
        mistakeContainer.classList.remove('hidden');
        mistakes.forEach(m => {
          const div = document.createElement('div');
          div.className = 'mistake-item';
          div.innerHTML = `<span>${m.q}</span><span class="mistake-ans">${m.correct}</span>`;
          mistakeList.appendChild(div);
        });
      } else {
        mistakeContainer.classList.add('hidden');
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
    const userAnswer = parseInt(inputBuffer.join(''), 10);
    const isOk = userAnswer === currentQuestionData.a;
    
    if (isOk) {
      correctCount++;
    } else {
      // ★間違えた問題を記録（式、正解、ユーザーの回答を保存）
      mistakes.push({
        q: currentQuestionData.q.replace('?', ''), // "2 × 3 = " の形に
        correct: currentQuestionData.a,
        user: userAnswer
      });
    }
    
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

const keys = document.querySelectorAll('.key');

keys.forEach(key => {
  const press = () => key.classList.add('is-pressed');
  const release = () => key.classList.remove('is-pressed');

  // タッチイベント（スマホ用）
  key.addEventListener('touchstart', press, { passive: true });
  key.addEventListener('touchend', release, { passive: true });
  key.addEventListener('touchcancel', release, { passive: true });

  // マウスイベント（PC用）
  key.addEventListener('mousedown', press);
  window.addEventListener('mouseup', release);
});
  
})();