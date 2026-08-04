// ---------- Overview page ----------
let cachedUsers = null;
let cachedErrors = [];
let cachedStatuses = [];
let activityChart = null;
let errorsUnread = 0;

function onAdminReady(){
  listenErrors((errors, err) => {
    if(err){ return; }
    cachedErrors = errors;
    const openCount = errors.filter(e => !e.resolved).length;
    updateErrorBadge(openCount);
    if(location.hash.slice(1) === 'overview') renderOverview();
    if(location.hash.slice(1) === 'errors' && typeof renderErrors === 'function') renderErrors();
  });
  listenStatuses((statuses, err) => {
    if(err){ return; }
    cachedStatuses = statuses;
    const liveCount = statuses.filter(s => !(typeof s.expiresAt === 'number' && s.expiresAt < Date.now())).length;
    updateStoryBadge(liveCount);
    if(location.hash.slice(1) === 'statuses' && typeof renderStatuses === 'function') renderStatuses();
  });
  renderView();
}

function updateErrorBadge(count){
  errorsUnread = count;
  // দুইটা badge আছে — একটা ডেস্কটপ সাইডবারে, একটা মোবাইল বটম-নেভে
  document.querySelectorAll('.error-badge').forEach(badge => {
    if(count > 0){
      badge.textContent = count > 99 ? '99+' : count;
      badge.classList.remove('hidden');
    }else{
      badge.classList.add('hidden');
    }
  });
}

function updateStoryBadge(count){
  document.querySelectorAll('.story-badge').forEach(badge => {
    if(count > 0){
      badge.textContent = count > 99 ? '99+' : count;
      badge.classList.remove('hidden');
    }else{
      badge.classList.add('hidden');
    }
  });
}

async function renderOverview(){
  const grid = document.getElementById('statCards');
  const pulseWrap = document.getElementById('pulseChartWrap');
  const incidentsList = document.getElementById('incidentsList');
  grid.innerHTML = `<div class="loading">লোড হচ্ছে...</div>`;

  try{
    if(!cachedUsers) cachedUsers = await fetchAllUsers();
  }catch(e){
    grid.innerHTML = `<div class="loading err">ডেটা লোড করা যায়নি — Firestore rules চেক করুন।</div>`;
    return;
  }

  const stats = computeOverview(cachedUsers);
  grid.innerHTML = '';
  const cards = [
    { label: 'মোট ইউজার', value: stats.totalUsers, icon: 'users' },
    { label: 'আজ সক্রিয়', value: stats.activeToday, icon: 'bolt' },
    { label: 'এই সপ্তাহে সক্রিয়', value: stats.activeWeek, icon: 'chart-line' },
    { label: 'এই সপ্তাহে নতুন', value: stats.newWeek, icon: 'user-plus' },
    { label: 'গড় সেরা স্ট্রিক', value: stats.avgBestStreak, icon: 'fire' },
    { label: 'মোট আয়াত পঠিত', value: stats.totalAyahsRead.toLocaleString('bn-BD'), icon: 'book-quran' },
  ];
  cards.forEach(c => {
    grid.insertAdjacentHTML('beforeend', `
      <div class="stat-card">
        <div class="stat-icon"><i class="fa-solid fa-${c.icon}"></i></div>
        <div class="stat-value">${c.value}</div>
        <div class="stat-label">${c.label}</div>
      </div>`);
  });

  // ---- Activity pulse chart (14 din) + লাল ইনসিডেন্ট মার্কার ----
  const daily = aggregateDailyActivity(cachedUsers, 14);
  const errorsByDate = {};
  cachedErrors.forEach(e => {
    const dt = e.timestamp?.toDate ? e.timestamp.toDate() : null;
    if(!dt) return;
    const key = dt.toISOString().slice(0, 10);
    errorsByDate[key] = (errorsByDate[key] || 0) + 1;
  });

  pulseWrap.innerHTML = '<canvas id="pulseCanvas" height="90"></canvas>';
  const ctx = document.getElementById('pulseCanvas').getContext('2d');
  if(activityChart) activityChart.destroy();
  activityChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: daily.map(d => d.date.slice(5)),
      datasets: [
        {
          label: 'পড়ার মিনিট (সব ইউজার মিলিয়ে)',
          data: daily.map(d => d.minutes),
          borderColor: '#d7a34d',
          backgroundColor: 'rgba(215,163,77,0.12)',
          tension: 0.35,
          fill: true,
          pointRadius: daily.map(d => errorsByDate[d.date] ? 5 : 2),
          pointBackgroundColor: daily.map(d => errorsByDate[d.date] ? '#ef4a4f' : '#d7a34d'),
          pointBorderColor: daily.map(d => errorsByDate[d.date] ? '#ef4a4f' : '#d7a34d'),
        }
      ]
    },
    options: {
      plugins: { legend: { labels: { color: '#a9b1c3' } } },
      scales: {
        x: { ticks: { color: '#7d859c' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#7d859c' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true }
      }
    }
  });

  // ---- Recent incidents strip ----
  const openErrors = cachedErrors.filter(e => !e.resolved).slice(0, 5);
  if(openErrors.length === 0){
    incidentsList.innerHTML = `<div class="empty-ok"><i class="fa-solid fa-circle-check"></i> কোনো নতুন সমস্যা নেই — সব ঠিক আছে।</div>`;
  }else{
    incidentsList.innerHTML = openErrors.map(e => `
      <div class="incident-row" data-id="${e.id}">
        <span class="dot-red"></span>
        <span class="incident-msg">${escapeHtml(e.message || 'অজানা এরর')}</span>
        <span class="incident-page">${escapeHtml(e.page || '')}</span>
        <span class="incident-time">${formatTime(e.timestamp)}</span>
      </div>`).join('');
    incidentsList.querySelectorAll('.incident-row').forEach(row => {
      row.addEventListener('click', () => navigateTo('errors'));
    });
  }
}

function escapeHtml(str){
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function formatTime(ts){
  if(!ts?.toDate) return '';
  const d = ts.toDate();
  return d.toLocaleString('bn-BD', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
