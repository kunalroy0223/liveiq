// wall.js
// Full file — do NOT shorten. Assumes firebase has already been initialized.

document.addEventListener('DOMContentLoaded', () => {
  const db = firebase.firestore();

  /* =======================
     DOM CACHE
     ======================= */
  const questionDisplay = document.getElementById('questionDisplay');
  const waitingMessage = document.getElementById('waitingMessage');
  const statusDisplay = document.getElementById('statusDisplay'); // not used in your HTML, keep if needed
  const leaderboardDisplay = document.getElementById('leaderboard');
  const activeUsersDisplay = document.getElementById('activeUsers');
  const leftContainer = document.querySelector('.left-container');
  const loader = document.getElementById('loader'); // your existing spinner div

  if (!questionDisplay || !leftContainer || !waitingMessage) {
    console.error('Required DOM elements missing (#questionDisplay, #waitingMessage or .left-container)');
    return;
  }

  /* =======================
     DYNAMIC UI ELEMENTS
     (timer circle, answer reveal,
      admin overlay, popup container)
     ======================= */

  // Answer reveal box (green) below loader
  const answerRevealBox = document.createElement('div');
  answerRevealBox.id = 'answerReveal';
  answerRevealBox.style.cssText = `
    margin-top: 12px;
    padding: 18px;
    background-color: rgba(76,175,80,0.12);
    border-radius: 10px;
    font-size: 4.6rem;
    font-weight: 800;
    color: #2e7d32;
    text-align: center;
    min-height: 56px;
    display: block;
    opacity: 0;
    transition: opacity .4s ease;
  `;
  loader.insertAdjacentElement('afterend', answerRevealBox);

  // Timer circle top-right
  const timerCircle = document.createElement('div');
  timerCircle.id = 'timerCircle';
  timerCircle.style.cssText = `
    position: absolute;
    top: 18px;
    right: 18px;
    width: 84px;
    height: 84px;
    border-radius: 50%;
    background: #333;
    color: var(--text-color, #a8a8a8);
    display:flex;
    align-items:center;
    justify-content:center;
    font-weight:800;
    font-size:1.2rem;
    box-shadow: 0 6px 18px rgba(0,0,0,.6);
    transform-origin: center;
    visibility: hidden;
    z-index: 30;
    transition: transform .12s ease, background-color .25s ease, opacity .25s ease;
  `;
  leftContainer.style.position = leftContainer.style.position || 'relative';
  leftContainer.appendChild(timerCircle);

  // Popup container at bottom center of left container for small notices
  const popupContainer = document.createElement('div');
  popupContainer.id = 'popupContainer';
  popupContainer.style.cssText = `
    position:absolute;
    bottom:18px;
    left:50%;
    transform:translateX(-50%);
    z-index:40;
    pointer-events:none;
    display:flex;
    flex-direction:column;
    gap:8px;
    align-items:center;
    width: calc(100% - 40px);
    max-width: 540px;
  `;
  leftContainer.appendChild(popupContainer);

  // Admin overlay (center of left container) for major admin messages like "quiz not started", "quiz ended"
  const adminOverlay = document.createElement('div');
  adminOverlay.id = 'adminOverlay';
  adminOverlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: none;
    align-items: center;
    justify-content: center;
    background: rgba(4,6,8,0.85);
    z-index: 999;
    color: #fff;
    padding: 20px;
    text-align:center;
    pointer-events: auto;
  `;
  const adminOverlayInner = document.createElement('div');
  adminOverlayInner.style.cssText = `
    display:flex;
    flex-direction:column;
    gap:18px;
    align-items:center;
    justify-content:center;
    max-width: 820px;
    width: 90%;
  `;
  const adminOverlaySpinner = document.createElement('div');
  adminOverlaySpinner.style.cssText = `
    width:90px; height:90px;
    border-radius:50%;
    border:10px solid rgba(255,255,255,0.1);
    border-top-color: #4caf50;
    animation: spin 1s linear infinite;
  `;
  const adminOverlayText = document.createElement('div');
  adminOverlayText.style.cssText = `
    font-size:1.6rem;
    font-weight:700;
    color: #fff;
  `;
  adminOverlayInner.appendChild(adminOverlaySpinner);
  adminOverlayInner.appendChild(adminOverlayText);
  adminOverlay.appendChild(adminOverlayInner);
  leftContainer.appendChild(adminOverlay);

  // Add keyframes for spinner if not present (will not duplicate)
  (function addSpinnerKeyframes() {
    const id = 'walljs-spinner-keyframes';
    if (!document.getElementById(id)) {
      const s = document.createElement('style');
      s.id = id;
      s.innerHTML = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes breathe {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.03); opacity: .95; }
        100% { transform: scale(1); opacity: 1; }
      }`;
      document.head.appendChild(s);
    }
  })();

  /* =======================
     STATE
     ======================= */
  let questions = [];
  let users = [];
  let currentQuestionId = null;
  let lastQuestionId = null;
  let revealShownForQuestion = null;

  let timeLeft = 30;
  let timerInterval = null;
  let pulseInterval = null;
  let isTimerRunning = false;
  let wasPaused = false;
  let lastTimerColor = '';
  let timerEnded = false; // explicit flag: set true when timer hits 0
  let waitingShown = false; // prevents double message
  let lastOverlayMessage = '';
  let lastPopupMessage = '';
  let popupLock = false;

  /* =======================
     UI helper functions
     ======================= */

  function showPopup(message, type = 'info') {
    if (popupLock && message === lastPopupMessage) return;
    lastPopupMessage = message;
    popupLock = true;
    setTimeout(() => { popupLock = false; }, 1200);

    const el = document.createElement('div');
    el.className = `popup-message ${type}`;
    el.textContent = message;
    el.style.cssText = `
      background: ${type === 'error' ? 'rgba(244,67,54,0.95)' : 'rgba(76,175,80,0.95)'};
      color: #fff;
      padding: 10px 14px;
      border-radius: 8px;
      font-weight:700;
      pointer-events:auto;
      box-shadow: 0 6px 18px rgba(0,0,0,.4);
      transform-origin:center;
      opacity:0;
      transition: transform .18s ease, opacity .2s ease;
      max-width: 100%;
      text-align:center;
    `;
    popupContainer.appendChild(el);

    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0) scale(1)';
    });

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px) scale(.98)';
      setTimeout(() => el.remove(), 300);
    }, 1700);
  }

  function showAdminOverlay(message) {
    if (lastOverlayMessage === message && adminOverlay.style.display === 'flex') return;
    lastOverlayMessage = message;
    adminOverlayText.textContent = message;
    adminOverlay.style.display = 'flex';

    questionDisplay.style.visibility = 'hidden';
    hideTimer();
    hideWaitingMessage();
    hideAnswerReveal();
  }

  function hideAdminOverlay() {
    lastOverlayMessage = '';
    adminOverlay.style.display = 'none';
    adminOverlayText.textContent = '';
    questionDisplay.style.visibility = 'visible';
  }

  // Updated to toggle both opacity and visibility on waitingMessage
  function showWaitingMessage(message) {
    if (waitingShown && waitingMessage.textContent === message) return;

    waitingMessage.textContent = message;
    waitingMessage.style.opacity = '1';
    waitingMessage.style.visibility = 'visible';
    loader.style.display = 'block';
    waitingShown = true;
  }

  function hideWaitingMessage() {
    waitingMessage.style.opacity = '0';
    waitingMessage.style.visibility = 'hidden';
    waitingMessage.textContent = '';
    loader.style.display = 'none';
    waitingShown = false;
  }

  function showAnswerReveal(text) {
    answerRevealBox.textContent = text;
    answerRevealBox.style.opacity = '1';
    answerRevealBox.style.animation = 'breathe 1.6s ease-in-out infinite';
  }

  function hideAnswerReveal() {
    answerRevealBox.style.opacity = '0';
    answerRevealBox.style.animation = 'none';
    answerRevealBox.textContent = '';
  }

  /* =======================
     TIMER helpers (robust)
     ======================= */

  function clearTimerIntervals() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    if (pulseInterval) { clearInterval(pulseInterval); pulseInterval = null; }
    isTimerRunning = false;
  }

  function updateTimerColor(sec) {
    const color = sec > 20 ? '#4CAF50' : (sec > 10 ? '#FF9800' : '#F44336');
    if (color !== lastTimerColor) {
      lastTimerColor = color;
      timerCircle.style.backgroundColor = color;
      timerCircle.style.color = '#fff';
      timerCircle.style.transform = 'scale(1.12)';
      setTimeout(() => { if (timerCircle) timerCircle.style.transform = 'scale(1)'; }, 140);
    }
  }

  function updateTimerText() {
    if (timeLeft > 0) {
      timerCircle.textContent = `${timeLeft}s`;
      timerCircle.style.opacity = '1';
    } else {
      timerCircle.textContent = '';
    }
  }

  function startTimer(resetTo = 30) {
    clearTimerIntervals();
    timerEnded = false;
    waitingShown = false;
    timeLeft = Number(resetTo) || 30;
    updateTimerColor(timeLeft);
    updateTimerText();

    timerCircle.style.visibility = 'visible';
    timerCircle.style.opacity = '1';
    hideWaitingMessage();
    hideAnswerReveal();
    hideAdminOverlay();

    isTimerRunning = true;

    pulseInterval = setInterval(() => {
      if (timeLeft > 0 && timeLeft < 10) {
        timerCircle.style.transform = 'scale(1.06)';
        setTimeout(() => { if (timerCircle) timerCircle.style.transform = 'scale(1)'; }, 160);
      }
    }, 900);

    timerInterval = setInterval(() => {
      timeLeft = Math.max(0, timeLeft - 1);
      updateTimerColor(timeLeft);
      updateTimerText();

      if (timeLeft === 0) {
        timerEnded = true;
        clearTimerIntervals();
        if (!waitingShown) {
          showWaitingMessage('Waiting for admin to reveal answer');
          timerCircle.style.visibility = 'hidden';
        }
      }
    }, 1000);
  }

  function pauseTimer() {
    clearTimerIntervals();
  }

  function hideTimer() {
    clearTimerIntervals();
    timerCircle.style.visibility = 'hidden';
    timerCircle.style.opacity = '0';
    timeLeft = 30;
    timerEnded = false;
    waitingShown = false;
  }

  /* =======================
     RENDER helpers for leaderboard & active users
     ======================= */

  function renderLeaderboard() {
    if (!leaderboardDisplay) return;
    leaderboardDisplay.innerHTML = '';

    // Create table element
    const table = document.createElement('table');
    table.className = 'leaderboard-table';

    // Create table header row
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Position', 'Name', 'Points'].forEach(text => {
      const th = document.createElement('th');
      th.textContent = text;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create table body
    const tbody = document.createElement('tbody');

    // Sort users by score descending
    const sortedUsers = users.slice().sort((a, b) => (b.score || 0) - (a.score || 0));

    // Icons for top 3 positions (emojis)
    const medals = ['🥇', '🥈', '🥉'];

    sortedUsers.forEach((user, idx) => {
      const tr = document.createElement('tr');

      // Position cell with medal icon for top 3
      const posTd = document.createElement('td');
      posTd.className = 'pos-cell';
      posTd.textContent = idx + 1;
      if (idx < 3) {
        const medalSpan = document.createElement('span');
        medalSpan.className = 'medal-icon medal-' + (idx + 1);
        medalSpan.textContent = medals[idx];
        posTd.prepend(medalSpan);
      }
      tr.appendChild(posTd);

      // Name cell
      const nameTd = document.createElement('td');
      const displayName = (user.username || user.name || 'Anonymous').toString();
      nameTd.textContent = displayName;
      tr.appendChild(nameTd);

      // Points cell
      const pointsTd = document.createElement('td');
      pointsTd.textContent = Number.isFinite(user.score) ? user.score : 0;
      pointsTd.className = 'points-cell';
      tr.appendChild(pointsTd);

      // Add special classes for top 3 rows for background highlights
      if (idx === 0) tr.classList.add('top1');
      else if (idx === 1) tr.classList.add('top2');
      else if (idx === 2) tr.classList.add('top3');

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    leaderboardDisplay.appendChild(table);
  }

  function renderActiveUsers() {
    if (!activeUsersDisplay) return;
    const now = Date.now();
    const activeCount = users.filter(u => {
      const last = u.lastActive?.toDate?.().getTime?.() ?? u.createdAt?.toDate?.().getTime?.() ?? 0;
      return (now - last) < 7 * 24 * 3600 * 1000;
    }).length;

    const newText = `Active users: ${activeCount}`;
    if (activeUsersDisplay.textContent !== newText) {
      activeUsersDisplay.textContent = newText;
    }
  }

  /* =======================
     FIRESTORE LISTENERS
     ======================= */

  db.collection('questions').orderBy('order').onSnapshot(snapshot => {
    questions = [];
    snapshot.forEach(doc => questions.push({ id: doc.id, ...doc.data() }));
  }, err => console.error('questions snapshot error', err));

  db.collection('users').onSnapshot(snapshot => {
    users = [];
    snapshot.forEach(doc => users.push({ id: doc.id, ...doc.data() }));
    renderLeaderboard();
    renderActiveUsers();
  }, err => console.error('users snapshot error', err));

  const liveDocRef = db.collection('live').doc('current');

  liveDocRef.onSnapshot(async snap => {
    if (!snap.exists) {
      questionDisplay.style.textAlign = 'center';
      questionDisplay.textContent = '';
      hideTimer();
      showAdminOverlay('Waiting for admin to start the quiz...');
      revealShownForQuestion = null;
      currentQuestionId = null;
      lastQuestionId = null;
      return;
    }

    const data = snap.data();

    if (!data.isStarted) {
      questionDisplay.style.textAlign = 'center';
      questionDisplay.textContent = '';
      hideTimer();
      showAdminOverlay('Waiting for admin to start the quiz...');
      revealShownForQuestion = null;
      currentQuestionId = null;
      lastQuestionId = null;
      return;
    }

    hideAdminOverlay();

    if (data.isPaused) {
      if (!wasPaused) {
        showPopup('Quiz Paused', 'error');
        wasPaused = true;
      }
      pauseTimer();
    } else {
      if (wasPaused) {
        showPopup('Quiz Resumed', 'info');
      }
      wasPaused = false;
    }

    if (!data.activeQuestionRef) {
      questionDisplay.style.textAlign = 'center';
      questionDisplay.textContent = 'Waiting for admin to select the next question...';
      hideTimer();
      showAdminOverlay('Waiting for admin to select the next question...');
      currentQuestionId = null;
      lastQuestionId = null;
      revealShownForQuestion = null;
      return;
    }

    let qDoc = null;
    try {
      if (typeof data.activeQuestionRef.get === 'function') {
        qDoc = await data.activeQuestionRef.get();
      } else {
        const id = (typeof data.activeQuestionRef === 'string') ? data.activeQuestionRef : (data.activeQuestionRef && data.activeQuestionRef.id);
        if (id) qDoc = await db.collection('questions').doc(id).get();
      }
    } catch (err) {
      console.error('Error resolving activeQuestionRef', err);
    }

    if (!qDoc || !qDoc.exists) {
      questionDisplay.style.textAlign = 'center';
      questionDisplay.textContent = 'Question not found.';
      hideTimer();
      hideWaitingMessage();
      hideAnswerReveal();
      return;
    }

    const qId = qDoc.id;
    const qData = qDoc.data();

    currentQuestionId = qId;

    if (lastQuestionId !== qId) {
      lastQuestionId = qId;
      revealShownForQuestion = null;
      questionDisplay.style.textAlign = 'center';
      questionDisplay.textContent = qData.questionText || '';
      hideAnswerReveal();
      hideWaitingMessage();
      hideAdminOverlay();

      if (!data.isPaused) {
        startTimer(30);
      } else {
        hideTimer();
      }
    } else {
      if (!isTimerRunning && !data.isPaused && !timerEnded) {
        startTimer(timeLeft > 0 ? timeLeft : 30);
      }
    }

    if (timerEnded && !data.revealAnswer && !waitingShown) {
      showWaitingMessage('Waiting for admin to reveal answer');
      timerCircle.style.visibility = 'hidden';
    }

    if (data.revealAnswer && currentQuestionId && revealShownForQuestion !== currentQuestionId) {
      let answer = (questions.find(q => q.id === currentQuestionId) || {}).answer;
      if (answer === undefined) {
        try {
          const qSnap = await db.collection('questions').doc(currentQuestionId).get();
          answer = qSnap.exists ? qSnap.data().answer : '(No answer provided)';
        } catch (e) {
          answer = '(No answer provided)';
        }
      }

      revealShownForQuestion = currentQuestionId;

      showAnswerReveal(String(answer ?? '(No answer provided)'));
      hideWaitingMessage();
      hideTimer();
      showPopup('Answer revealed', 'info');
      timerEnded = false;
      waitingShown = false;
    }

  }, (err) => {
    console.error('live doc snapshot error', err);
  });

  /* =======================
     Cleanup on unload
     ======================= */
  window.addEventListener('beforeunload', () => {
    clearTimerIntervals();
  });

  /* =======================
     End of file
     ======================= */

});
