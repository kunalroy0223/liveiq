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
      max-height: 500px;
      overflow-y: auto;
      border: 1px solid #444;
      border-radius: 8px;
      padding: 6px;
      background: #222;
      margin-bottom: 12px;
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
      background-color: #4caf50;
      color: white;
      display: flex;
      justify-content: center;
      align-items: center;
      font-weight: 700;
      font-size: 1rem;
      user-select: none;
      margin: 4px 6px 4px 0;
      flex-shrink: 0;
      box-shadow: 0 0 6px #2e7d32;
    `;
    return avatar;
  }

  // Render active users as avatar circles
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
      flex-wrap: wrap;
      gap: 6px;
      max-height: 120px;
      overflow-y: auto;
      padding: 4px;
      border: 1px solid #444;
      border-radius: 8px;
      background: #222;
    `;

    activeUsers.forEach(user => {
      const name = user.username || user.name || 'Anon';
      const avatar = createAvatarCircle(name);
      container.appendChild(avatar);
    });

    const countText = document.createElement('div');
    countText.textContent = `Active users: ${activeUsers.length}`;
    countText.style.cssText = `
      font-weight: 700;
      margin-bottom: 6px;
      color: #a8a8a8;
    `;

    activeUsersDisplay.appendChild(countText);
    activeUsersDisplay.appendChild(container);
  }

  // Render leaderboard WITHOUT avatar circles (plain names)
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

    // Sort users descending by score
    const sortedUsers = users.slice().sort((a, b) => (b.score || 0) - (a.score || 0));
    const medals = ['🥇', '🥈', '🥉'];

    sortedUsers.forEach((user, idx) => {
      const tr = document.createElement('tr');

      // Position with medal icons for top 3
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

      // Name plain text
      const nameTd = document.createElement('td');
      nameTd.textContent = (user.username || user.name || 'Anonymous').toString();
      tr.appendChild(nameTd);

      // Points cell
      const pointsTd = document.createElement('td');
      pointsTd.textContent = Number.isFinite(user.score) ? user.score : 0;
      pointsTd.className = 'points-cell';
      tr.appendChild(pointsTd);

      // Highlight top 3 rows
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

  // Listen to users collection updates and render
  db.collection('users').onSnapshot(snapshot => {
    const users = [];
    snapshot.forEach(doc => users.push({ id: doc.id, ...doc.data() }));

    renderLeaderboardPlain(users);
    renderActiveUsersWithAvatars(users);
  }, err => console.error('users snapshot error', err));

  // Minimal styles for table & avatars
  const style = document.createElement('style');
  style.textContent = `
    #leaderboardScrollContainer {
      max-height: 500px;
      overflow-y: auto;
      border: 1px solid #444;
      border-radius: 8px;
      padding: 6px;
      background: #222;
      margin-bottom: 12px;
    }
    .leaderboard-table {
      width: 100%;
      border-collapse: collapse;
      color: #eee;
    }
    .leaderboard-table th, .leaderboard-table td {
      padding: 6px 12px;
      border-bottom: 1px solid #444;
    }
    .leaderboard-table .pos-cell {
      width: 50px;
      text-align: center;
      font-weight: 700;
    }
    .leaderboard-table .points-cell {
      text-align: center;
      font-weight: 700;
    }
    .medal-icon {
      margin-right: 6px;
      font-size: 1.1rem;
    }
    .top1 {
      background: #2e7d32a0;
    }
    .top2 {
      background: #558b2fa0;
    }
    .top3 {
      background: #f9a825a0;
      color: #333;
    }
  `;
  document.head.appendChild(style);
});
