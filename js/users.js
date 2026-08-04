// ---------- User management page ----------
let usersRenderedOnce = false;

async function renderUsers(){
  const tbody = document.getElementById('usersTbody');
  const searchInput = document.getElementById('userSearch');

  if(!cachedUsers){
    tbody.innerHTML = `<tr><td colspan="5" class="loading">লোড হচ্ছে...</td></tr>`;
    try{ cachedUsers = await fetchAllUsers(); }
    catch(e){ tbody.innerHTML = `<tr><td colspan="5" class="loading err">লোড ব্যর্থ হয়েছে</td></tr>`; return; }
  }

  const draw = () => {
    const q = (searchInput.value || '').trim().toLowerCase();
    const rows = cachedUsers
      .filter(u => !q || (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))
      .sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));

    if(rows.length === 0){
      tbody.innerHTML = `<tr><td colspan="5" class="loading">কোনো ইউজার পাওয়া যায়নি</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(u => `
      <tr data-uid="${u.id}" class="user-row">
        <td>${escapeHtml(u.name || '—')}</td>
        <td>${escapeHtml(u.email || '—')}</td>
        <td>${u.progress?.bestStreak ?? 0}</td>
        <td>${u.progress?.ayahsReadCount ?? 0}</td>
        <td>${formatTime(u.updatedAt)}</td>
      </tr>`).join('');
    tbody.querySelectorAll('.user-row').forEach(row => {
      row.addEventListener('click', () => openUserDrawer(row.dataset.uid));
    });
  };

  draw();
  if(!usersRenderedOnce){
    searchInput.addEventListener('input', draw);
    usersRenderedOnce = true;
  }
}

async function openUserDrawer(uid){
  const user = cachedUsers.find(u => u.id === uid);
  if(!user) return;
  const drawer = document.getElementById('userDrawer');
  const body = document.getElementById('userDrawerBody');
  drawer.classList.remove('hidden');
  body.innerHTML = `<div class="loading">লোড হচ্ছে...</div>`;

  let sessions = [];
  try{ sessions = await fetchSessions(uid); }catch(e){ /* ignore */ }

  const p = user.progress || {};
  body.innerHTML = `
    <h3>${escapeHtml(user.name || 'নাম নেই')}</h3>
    <p class="muted">${escapeHtml(user.email || '')} · ${escapeHtml(user.position || '')}</p>
    <div class="drawer-stats">
      <div><span>${p.bestStreak ?? 0}</span>সেরা স্ট্রিক</div>
      <div><span>${p.ayahsReadCount ?? 0}</span>আয়াত পঠিত</div>
      <div><span>${p.audioSurahsPlayedCount ?? 0}</span>সূরা শোনা</div>
      <div><span>${p.searchCount ?? 0}</span>সার্চ</div>
    </div>
    <h4>সেশন / লগইন হিস্টোরি</h4>
    <div class="session-list">
      ${sessions.length ? sessions.map(s => `
        <div class="session-row" data-uid="${uid}" data-sid="${s.id}">
          <i class="fa-solid fa-${s.deviceType === 'mobile' ? 'mobile-screen' : 'desktop'}"></i>
          <div class="session-meta">
            <div>${escapeHtml(s.browser || '')} · ${escapeHtml(s.os || '')}</div>
            <div class="muted small">${escapeHtml(s.city || '')} ${escapeHtml(s.country || '')} · ${formatTime(s.createdAt)}</div>
          </div>
          <button class="icon-btn danger revoke-session" title="সেশন মুছুন"><i class="fa-solid fa-xmark"></i></button>
        </div>`).join('') : '<p class="muted">কোনো সেশন রেকর্ড নেই</p>'}
    </div>
    <button class="btn danger full" id="deleteUserBtn"><i class="fa-solid fa-trash"></i> এই ইউজার ডকুমেন্ট মুছে ফেলুন</button>
  `;

  body.querySelectorAll('.revoke-session').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const row = e.target.closest('.session-row');
      if(!confirm('এই সেশনটি মুছে ফেলবেন?')) return;
      await deleteSession(row.dataset.uid, row.dataset.sid);
      openUserDrawer(uid);
    });
  });

  document.getElementById('deleteUserBtn').addEventListener('click', async () => {
    if(!confirm(`${user.name || user.email} — এই ইউজারের Firestore ডকুমেন্ট স্থায়ীভাবে মুছে যাবে (Auth অ্যাকাউন্ট থাকবে)। নিশ্চিত?`)) return;
    await deleteUserDoc(uid);
    cachedUsers = cachedUsers.filter(u => u.id !== uid);
    closeUserDrawer();
    renderUsers();
  });
}

function closeUserDrawer(){
  document.getElementById('userDrawer').classList.add('hidden');
}
document.getElementById('closeDrawerBtn')?.addEventListener('click', closeUserDrawer);
