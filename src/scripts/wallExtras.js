// wallExtras.js

document.addEventListener('DOMContentLoaded', () => {
  const leaderboardDisplay = document.getElementById('leaderboard');
  const activeUsersDisplay = document.getElementById('activeUsers');

  if (!leaderboardDisplay || !activeUsersDisplay) {
    console.error('Leaderboard or ActiveUsers element missing!');
    return;
  }

  // Wrap leaderboard in a scrollable container (if not already wrapped)
  if (!document.getElementById('leaderboardScrollContainer')) {
    const scrollWrapper = document.createElement('div');
    scrollWrapper.id = 'leaderboardScrollContainer';
    scrollWrapper.style.cssText = `
      max-height: calc(23 * 32px); /* 23 rows before scroll */
      overflow-y: auto;
      border: 1px solid #444;
      border-radius: 10px;
      padding: 6px;
      background: linear-gradient(135deg, #1e1e1e, #2a2a2a);
      margin-bottom: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    leaderboardDisplay.parentNode.insertBefore(scrollWrapper, leaderboardDisplay);
    scrollWrapper.appendChild(leaderboardDisplay);
  }

  // Create avatar circle for a user name's first initial
  function createAvatarCircle(name) {
    const initial = (name && name[0]) ? name[0].toUpperCase() : '?';
    const avatar = document.createElement('div');
    avatar.className = 'user-avatar-circle';
    avatar.textContent = initial;
    avatar.title = name;
    avatar.style.cssText = `
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #4caf50;
      color: white;
      display: flex;
      justify-content: center;
      align-items: center;
      font-weight: 700;
      font-size: 1rem;
      user-select: none;
      flex-shrink: 0;
      border: 2px solid #222;
      box-shadow: 0 0 6px rgba(0,0,0,0.4);
    `;
    return avatar;
  }

  // Render active users as avatar circles (overlapping)
  function renderActiveUsersWithAvatars(users) {
    activeUsersDisplay.innerHTML = '';

    const now = Date.now();
    const activeUsers = users.filter(u => {
      const last = u.lastActive?.toDate?.().getTime?.() ?? u.createdAt?.toDate?.().getTime?.() ?? 0;
      return (now - last) < 7 * 24 * 3600 * 1000; // Active in last 7 days
    });

    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      align-items: center;
      padding: 4px;
    `;

    activeUsers.slice(0, 6).forEach((user, index) => {
      const name = user.username || user.name || 'Anon';
      const avatar = createAvatarCircle(name);
      avatar.style.marginLeft = index === 0 ? "0px" : "-10px"; // overlap effect
      container.appendChild(avatar);
    });

    if (activeUsers.length > 6) {
      const more = document.createElement("div");
      more.textContent = `+${activeUsers.length - 6}`;
      more.style.cssText = `
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: black;
        color: white;
        display: flex;
        justify-content: center;
        align-items: center;
        font-weight: 700;
        margin-left: -10px;
        border: 2px solid #222;
      `;
      container.appendChild(more);
    }

    const countText = document.createElement('div');
    countText.textContent = `Active users: ${activeUsers.length}`;
    countText.style.cssText = `
      font-weight: 700;
      margin-bottom: 6px;
      color: #a8a8a8;
      text-align: center;
    `;

    activeUsersDisplay.appendChild(countText);
    activeUsersDisplay.appendChild(container);
  }

  // Render leaderboard
  function renderLeaderboardPlain(users) {
    leaderboardDisplay.innerHTML = '';

    const table = document.createElement('table');
    table.className = 'leaderboard-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Position', 'Name', 'Points'].forEach(text => {
      const th = document.createElement('th');
      th.textContent = text;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    // Sort users by score
    const sortedUsers = users.slice().sort((a, b) => (b.score || 0) - (a.score || 0));
    const medals = ['🥇', '🥈', '🥉'];

    sortedUsers.forEach((user, idx) => {
      const tr = document.createElement('tr');

      // Position column (medals for top 3)
      const posTd = document.createElement('td');
      posTd.className = 'pos-cell';
      if (idx < 3) {
        const medalSpan = document.createElement('span');
        medalSpan.className = 'medal-icon medal-' + (idx + 1);
        medalSpan.textContent = medals[idx];
        posTd.textContent = ""; 
        posTd.appendChild(medalSpan);
      } else {
        posTd.textContent = idx + 1;
      }
      tr.appendChild(posTd);

      // Name column
      const nameTd = document.createElement('td');
      nameTd.textContent = (user.username || user.name || 'Anonymous').toString();
      tr.appendChild(nameTd);

      // Points column
      const pointsTd = document.createElement('td');
      pointsTd.textContent = Number.isFinite(user.score) ? user.score : 0;
      pointsTd.className = 'points-cell';
      tr.appendChild(pointsTd);

      // Highlight top rows
      if (idx === 0) tr.classList.add('top1');
      else if (idx === 1) tr.classList.add('top2');
      else if (idx === 2) tr.classList.add('top3');

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    leaderboardDisplay.appendChild(table);
  }

  // Firestore connection
  const db = firebase.firestore();

  // Listen to users collection updates
  db.collection('users').onSnapshot(snapshot => {
    const users = [];
    snapshot.forEach(doc => users.push({ id: doc.id, ...doc.data() }));

    renderLeaderboardPlain(users);
    renderActiveUsersWithAvatars(users);
  }, err => console.error('users snapshot error', err));

  // Styles
  const style = document.createElement('style');
  style.textContent = `
    #leaderboardScrollContainer {
      max-height: calc(23 * 32px);
      overflow-y: auto;
      border: 1px solid #444;
      border-radius: 10px;
      background: linear-gradient(135deg, #1e1e1e, #2a2a2a);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      scrollbar-gutter: stable both-edges;
    }
    /* Ensure only the wrapper scrolls (prevents double scrollbars) */
    #leaderboard {
      overflow: visible !important;
      max-height: none !important;
    }

    .leaderboard-table {
      width: 100%;
      border-collapse: collapse;
      color: #eee;
      text-align: center; /* center align all text */
      overflow: visible;  /* avoid inner scroll */
    }
    /* Header styling in green like avatars */
    .leaderboard-table th {
      background: transparent;
      color: #4caf50;            /* green text */
      font-weight: 700;
      padding: 6px 10px;
      border-bottom: 2px solid #4caf50; /* green underline */
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .leaderboard-table td {
      padding: 6px 10px;
      border-bottom: 1px solid #444;
    }
    /* Reduce visual gap between Position and Name */
    .leaderboard-table th:nth-child(1),
    .leaderboard-table td:nth-child(1) {
      width: 44px;               /* narrower position column */
      padding-right: 6px;
    }
    .leaderboard-table th:nth-child(2),
    .leaderboard-table td:nth-child(2) {
      padding-left: 6px;         /* pulls name closer to position */
    }

    .leaderboard-table tr:hover {
      background: rgba(255,255,255,0.05);
      transition: 0.2s;
    }
    .leaderboard-table .pos-cell {
      font-weight: 700;
    }
    .leaderboard-table .points-cell {
      font-weight: 700;
    }
    .medal-icon {
      font-size: 1.2rem;
    }
    .top1 {
      background: rgba(46,125,50,0.6);
    }
    .top2 {
      background: rgba(85,139,47,0.6);
    }
    .top3 {
      background: rgba(249,168,37,0.7);
      color: #222;
    }
  `;
  document.head.appendChild(style);
});
