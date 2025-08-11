document.addEventListener('DOMContentLoaded', () => {
  const db = firebase.firestore();

  /* ========== DOM refs ========== */
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  const drawer = document.getElementById('drawer-navigation');
  const overlay = document.getElementById('overlay');
  const contentWrapper = document.getElementById('contentWrapper');
  const toasts = document.getElementById('toasts');
  const drawerHideBtn = drawer.querySelector('button[data-drawer-hide]');
  const drawerMenuLinks = drawer.querySelectorAll('[data-page]');

  /* ========== Hamburger & drawer toggles ========== */
  hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    hamburger.classList.toggle('toggle');
    if (window.innerWidth < 900) {
      if (drawer.classList.contains('open')) hideDrawer();
      else showDrawer();
    }
  });
  function closeMenu() {
    navLinks.classList.remove('open');
    hamburger.classList.remove('toggle');
  }
  function showDrawer() {
    drawer.classList.add('open');
    overlay.classList.add('visible');
    contentWrapper.classList.add('full');
  }
  function hideDrawer() {
    drawer.classList.remove('open');
    overlay.classList.remove('visible');
    contentWrapper.classList.remove('full');
  }
  if (drawerHideBtn) drawerHideBtn.addEventListener('click', () => { hideDrawer(); closeMenu(); });
  overlay.addEventListener('click', () => { hideDrawer(); closeQModal(); });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { hideDrawer(); closeQModal(); closeMenu(); }
  });
  drawerMenuLinks.forEach(a => {
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      drawerMenuLinks.forEach(x => x.classList.remove('active'));
      a.classList.add('active');
      document.querySelectorAll('main section').forEach(s => s.style.display = 'none');
      const el = document.getElementById('page-' + a.dataset.page);
      if (el) el.style.display = 'block';
      document.getElementById('pageHeading').innerText = a.textContent.trim();
      if (window.innerWidth <= 900) hideDrawer();
      closeMenu();
    });
  });
  if (window.innerWidth > 900) drawer.classList.add('open');

  /* ========== Toast utility ========== */
  function showToast(message, type = 'success', ttl = 2600) {
    const el = document.createElement('div');
    el.className = 'toast ' + (type === 'error' ? 'error' : 'success');
    el.innerHTML = `<i class="fa ${type === 'error' ? 'fa-times-circle' : 'fa-check-circle'}"></i><div>${message}</div>`;
    toasts.appendChild(el);
    setTimeout(() => el.remove(), ttl);
  }

  /* ========== Firestore Data ========== */
  let users = [];
  let questions = [];
  const currentLiveDocId = 'current'; // document controlling quiz state

  // Listen to users collection
  db.collection('users').onSnapshot(snapshot => {
    users = [];
    snapshot.forEach(doc => {
      users.push({ id: doc.id, ...doc.data() });
    });
    renderDashboard();
  });

  // Listen to questions collection ordered by 'order'
  db.collection('questions').orderBy('order').onSnapshot(snapshot => {
    questions = [];
    snapshot.forEach(doc => {
      questions.push({ id: doc.id, ...doc.data(), id: doc.id });
    });
    renderDashboard();
    renderQuestionsList();
  });

  // Listen live/current document for quiz state changes
  const liveDoc = db.collection('live').doc(currentLiveDocId);
  liveDoc.onSnapshot(doc => {
    if (!doc.exists) return;
    const data = doc.data();

    updateQuizControlButtons(data);
    updateActiveQuestionUI(data);
  });

  /* ========== Render Dashboard ========== */
  function renderDashboard() {
    const total = users.length;
    const now = Date.now();
    const active = users.filter(u => {
      const lastTime = u.lastActive ? u.lastActive.toDate().getTime() : (u.createdAt ? u.createdAt.toDate().getTime() : 0);
      return (now - lastTime) <= (7 * 24 * 60 * 60 * 1000);
    }).length;

    document.getElementById('totalUsers').innerText = total;
    document.getElementById('activeUsers').innerText = active;
  }

  /* ========== Render Questions List ========== */
  function renderQuestionsList() {
    const qList = document.getElementById('questionsList');
    const dash = document.getElementById('dashboardQuestions');
    const qCount = document.getElementById('qCount');
    qList.innerHTML = '';
    dash.innerHTML = '';
    qCount.innerText = questions.length;

    if (questions.length === 0) {
      qList.innerHTML = '<div class="small-muted">No questions yet</div>';
      dash.innerHTML = '<div class="small-muted">No questions yet</div>';
      return;
    }

    questions.forEach((q, idx) => {
      const createdStr = q.createdAt ? q.createdAt.toDate().toLocaleString() : '—';
      const answerDisplay = q.answer || '—';

      // Dashboard display
      const dashItem = document.createElement('div');
      dashItem.className = 'q-item';
      dashItem.innerHTML = `<div><div style="font-weight:700">${escapeHtml(q.questionText)}</div><div class="q-meta">order: ${q.order ?? idx + 1} • ${createdStr} • answers: ${escapeHtml(answerDisplay)}</div></div>`;
      dash.appendChild(dashItem);

      // Questions list with action buttons (no "Set Active")
      const listItem = document.createElement('div');
      listItem.className = 'q-item';
      listItem.innerHTML = `
        <div>
          <div style="font-weight:700">${escapeHtml(q.questionText)}</div>
          <div class="q-meta">id: ${q.id} • order: ${q.order ?? idx + 1}</div>
        </div>
        <div style="display:flex; gap:.4rem;">
          <button class="btn" data-action="edit" data-id="${q.id}"><i class="fa fa-edit"></i></button>
          <button class="btn" data-action="delete" data-id="${q.id}"><i class="fa fa-trash"></i></button>
        </div>`;
      qList.appendChild(listItem);
    });
  }

  /* ========== Escape HTML utility ========== */
  function escapeHtml(s = '') {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  /* ========== Question Modal and CRUD ========== */
  let currentModalAction = null;
  let currentEditingId = null;

  function openQModal(action, id = null) {
    currentModalAction = action;
    currentEditingId = id;

    document.getElementById('modalTitle').innerText = {
      add: 'Add Question',
      edit: 'Edit Question',
      delete: 'Delete Question',
    }[action] || 'Modal';

    document.getElementById('m_text').value = '';
    document.getElementById('m_answer').value = '';
    document.getElementById('m_bonus').value = 0;
    document.getElementById('m_order').value = '';

    if (id) {
      const q = questions.find(x => x.id === id);
      if (q) {
        document.getElementById('m_text').value = q.questionText || '';
        document.getElementById('m_answer').value = q.answer || '';
        document.getElementById('m_bonus').value = q.bonusTime || 0;
        document.getElementById('m_order').value = q.order || '';
      } else {
        showToast('Question id not found', 'error');
      }
    }

    document.getElementById('qModalOverlay').style.display = 'flex';
    overlay.classList.add('visible');
  }
  function closeQModal() {
    document.getElementById('qModalOverlay').style.display = 'none';
    overlay.classList.remove('visible');
    currentModalAction = null;
    currentEditingId = null;
  }

  document.getElementById('questionsList').addEventListener('click', e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    if (btn.dataset.action === 'edit' || btn.dataset.action === 'delete') {
      openQModal(btn.dataset.action, btn.dataset.id);
    }
  });

  document.getElementById('btnAdd').addEventListener('click', () => openQModal('add'));
  document.getElementById('modalCancel').addEventListener('click', closeQModal);

  document.getElementById('modalForm').addEventListener('submit', async e => {
    e.preventDefault();
    const text = document.getElementById('m_text').value.trim();
    const answer = document.getElementById('m_answer').value.trim();
    const bonus = Number(document.getElementById('m_bonus').value) || 0;
    const order = Number(document.getElementById('m_order').value) || (questions.length + 1);

    try {
      if (currentModalAction === 'add') {
        const newDocRef = await db.collection('questions').add({
          questionText: text,
          answer,
          bonusTime: bonus,
          order,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        // Automatically start quiz and set this question active
        await db.collection('live').doc(currentLiveDocId).set({
          isStarted: true,
          isPaused: false,
          revealAnswer: false,
          activeQuestionRef: newDocRef
        }, { merge: true });

        showToast('Question added and set active', 'success');
      } else if (currentModalAction === 'edit' && currentEditingId) {
        await db.collection('questions').doc(currentEditingId).update({
          questionText: text,
          answer,
          bonusTime: bonus,
          order
        });
        showToast('Question updated', 'success');
      } else if (currentModalAction === 'delete' && currentEditingId) {
        await db.collection('questions').doc(currentEditingId).delete();

        // Clear activeQuestionRef if deleted question was active
        const liveSnap = await db.collection('live').doc(currentLiveDocId).get();
        if (liveSnap.exists) {
          const data = liveSnap.data();
          if (data.activeQuestionRef && data.activeQuestionRef.id === currentEditingId) {
            await db.collection('live').doc(currentLiveDocId).update({ activeQuestionRef: null });
          }
        }

        showToast('Question deleted', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Operation failed', 'error');
    } finally {
      closeQModal();
    }
  });

  /* ========== Quiz Controls ========== */
  const quizControls = document.querySelector('#page-quiz');
  if (!quizControls) {
    console.error('Quiz controls container (#page-quiz) not found!');
    return;
  }

  quizControls.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.getAttribute('data-action');
    console.log('Quiz control clicked:', action);

    try {
      const liveRef = db.collection('live').doc(currentLiveDocId);
      const liveSnapshot = await liveRef.get();
      const liveData = liveSnapshot.exists ? liveSnapshot.data() : {};

      switch (action) {
        case 'start':
          await liveRef.set({
            isStarted: true,
            isPaused: false,
            revealAnswer: false,
            activeQuestionRef: liveData.activeQuestionRef || null
          }, { merge: true });
          showToast('Quiz started');
          break;

        case 'pause':
          if (!liveData.isStarted) {
            showToast('Quiz not started yet', 'error');
            break;
          }
          await liveRef.update({ isPaused: true });
          showToast('Quiz paused');
          break;

        case 'resume':
          if (!liveData.isStarted) {
            showToast('Quiz not started yet', 'error');
            break;
          }
          await liveRef.update({ isPaused: false });
          showToast('Quiz resumed');
          break;

        case 'end':
          if (!liveData.isStarted) {
            showToast('Quiz not started yet', 'error');
            break;
          }
          await liveRef.set({
            isStarted: false,
            isPaused: false,
            revealAnswer: false,
            activeQuestionRef: null
          }, { merge: true });
          showToast('Quiz ended');
          break;

        case 'reveal':
          if (!liveData.isStarted) {
            showToast('Quiz not started yet', 'error');
            break;
          }
          await liveRef.update({ revealAnswer: true });
          showToast('Answer revealed');
          break;

        case 'next':
          await advanceQuestion(1);
          break;

        case 'prev':
          await advanceQuestion(-1);
          break;

        default:
          console.warn('Unknown quiz control action:', action);
      }
    } catch (err) {
      console.error('Quiz control action error:', err);
      showToast('Failed to perform action', 'error');
    }
  });

  /* Advance question by offset (+1 for next, -1 for prev) */
  async function advanceQuestion(offset) {
    try {
      const liveSnap = await db.collection('live').doc(currentLiveDocId).get();
      if (!liveSnap.exists) {
        showToast('Quiz not started', 'error');
        return;
      }
      const data = liveSnap.data();
      const currentQId = data.activeQuestionRef ? data.activeQuestionRef.id : null;

      const idx = questions.findIndex(q => q.id === currentQId);
      let newIdx = idx + offset;

      if (newIdx < 0 || newIdx >= questions.length) {
        showToast(offset > 0 ? 'No next question' : 'No previous question', 'error');
        return;
      }

      const newQRef = db.collection('questions').doc(questions[newIdx].id);

      await db.collection('live').doc(currentLiveDocId).update({
        activeQuestionRef: newQRef,
        revealAnswer: false,
        isPaused: false,
        isStarted: true
      });
      showToast(`Question moved to: ${questions[newIdx].questionText}`);
    } catch (err) {
      console.error('Advance question error:', err);
      showToast('Failed to advance question', 'error');
    }
  }

  /* ========== Update Quiz Control Buttons UI based on live state ========== */
  function updateQuizControlButtons(data) {
    const actions = ['start', 'pause', 'resume', 'end', 'reveal', 'next', 'prev'];
    actions.forEach(action => {
      const btn = document.querySelector(`#page-quiz button[data-action="${action}"]`);
      if (!btn) return;

      // Default enable all
      btn.disabled = false;

      switch (action) {
        case 'start':
          btn.disabled = data.isStarted === true;
          break;
        case 'pause':
          btn.disabled = !data.isStarted || data.isPaused === true;
          break;
        case 'resume':
          btn.disabled = !data.isStarted || data.isPaused === false;
          break;
        case 'end':
          btn.disabled = !data.isStarted;
          break;
        case 'reveal':
          btn.disabled = !data.isStarted;
          break;
        case 'next':
          btn.disabled = !data.isStarted;
          break;
        case 'prev':
          btn.disabled = !data.isStarted;
          break;
      }
    });
  }

  /* ========== Update active question UI (optional) ========== */
  function updateActiveQuestionUI(data) {
    const activeQDisplay = document.getElementById('activeQuestionDisplay');
    if (!activeQDisplay) return;

    if (data.activeQuestionRef) {
      const q = questions.find(q => q.id === data.activeQuestionRef.id);
      activeQDisplay.textContent = q ? q.questionText : 'No active question';
    } else {
      activeQDisplay.textContent = 'No active question';
    }
  }

  /* ========== Other UI actions ========== */
  document.getElementById('viewLeaderboard').addEventListener('click', () => showToast('Leaderboard (mock)', 'success'));
  document.getElementById('resetScores').addEventListener('click', async () => {
    try {
      const batch = db.batch();
      const usersSnapshot = await db.collection('users').get();
      usersSnapshot.forEach(doc => {
        batch.update(doc.ref, { score: 0 });
      });
      await batch.commit();
      showToast('Scores reset');
    } catch (e) {
      showToast('Failed to reset scores', 'error');
    }
  });
  document.getElementById('exportResults').addEventListener('click', () => showToast('Exported (mock)', 'success'));
  document.getElementById('wordwall').addEventListener('click', () => showToast('Wordwall (mock)', 'success'));
  document.getElementById('wordcloud').addEventListener('click', () => showToast('Wordcloud (mock)', 'success'));
  document.getElementById('broadcast').addEventListener('click', () => showToast('Broadcast (mock)', 'success'));
  document.getElementById('setTitle').addEventListener('click', () => {
    const t = prompt('New title:');
    if (t) showToast('Title set to ' + t, 'success');
  });
  document.getElementById('manageAdmins').addEventListener('click', () => showToast('Manage admins (mock)', 'success'));
  document.getElementById('toggleTheme').addEventListener('click', () => {
    const cur = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    if (cur === '#0f1115') {
      document.documentElement.style.setProperty('--bg', '#f5f7fb');
      document.body.style.color = '#111';
    } else {
      document.documentElement.style.setProperty('--bg', '#0f1115');
      document.body.style.color = '#e6eef6';
    }
    showToast('Theme toggled', 'success');
  });

  // logout (mock)
  document.getElementById('logoutSide').addEventListener('click', () => {
    showToast('Logged out (mock)', 'success');
  });

});
function logout() {
    sessionStorage.clear();
    window.location.href = '../pages/login.html';
}