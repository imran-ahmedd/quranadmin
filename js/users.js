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

  // ---- গত ৩০ দিনের অ্যাক্টিভিটি লগ (যেদিন পড়েছে সেগুলোই দেখাবে) ----
  const activityEntries = Object.entries(p.activity || {})
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 30);

  // ---- অ্যাপে কোন কোন ফিচার ব্যবহার করেছে ----
  const featureFlags = [
    { on: p.qiblaUsed, label: 'কিবলা কম্পাস', icon: 'compass' },
    { on: p.tajweedModeUsed, label: 'তাজভীদ মোড', icon: 'microphone' },
    { on: p.hafezModeUsed, label: 'হাফেজ মোড', icon: 'graduation-cap' },
    { on: p.translationCompareUsed, label: 'অনুবাদ তুলনা', icon: 'language' },
    { on: p.ramadanModeUsed, label: 'রমজান মোড', icon: 'moon' },
    { on: p.prayerNotifyEverEnabled, label: 'নামাজের নোটিফিকেশন', icon: 'bell' },
    { on: p.nightOwlDone, label: 'নাইট আউল ব্যাজ', icon: 'star' },
    { on: p.earlyBirdDone, label: 'আর্লি বার্ড ব্যাজ', icon: 'sun' },
  ].filter(f => f.on);

  body.innerHTML = `
    <h3>${escapeHtml(user.name || 'নাম নেই')}</h3>
    <p class="muted">${escapeHtml(user.email || '')} · ${escapeHtml(user.position || '')}</p>
    <p class="muted small">যোগ দিয়েছেন: ${formatTime(user.createdAt) || '—'} · শেষ সিঙ্ক: ${formatTime(user.updatedAt) || '—'}</p>

    <div class="drawer-stats">
      <div><span>${p.bestStreak ?? 0}</span>সেরা স্ট্রিক</div>
      <div><span>${p.ayahsReadCount ?? 0}</span>আয়াত পঠিত</div>
      <div><span>${p.audioSurahsPlayedCount ?? 0}</span>সূরা শোনা</div>
      <div><span>${p.searchCount ?? 0}</span>সার্চ করেছে</div>
      <div><span>${p.topicsExploredCount ?? 0}</span>বিষয় ঘেঁটেছে</div>
      <div><span>${p.shareCount ?? 0}</span>শেয়ার করেছে</div>
    </div>

    ${p.taraweeh ? `
    <h4>তারাবীহ ট্র্যাকার</h4>
    <p class="muted small">${escapeHtml(JSON.stringify(p.taraweeh)).slice(0, 200)}</p>
    ` : ''}

    <h4>ব্যবহার করা ফিচার</h4>
    <div class="feature-tags">
      ${featureFlags.length ? featureFlags.map(f => `<span class="feature-tag"><i class="fa-solid fa-${f.icon}"></i> ${f.label}</span>`).join('')
        : '<p class="muted small">কোনো এক্সট্রা ফিচার এখনো ব্যবহার করেনি</p>'}
    </div>
    ${(p.themesTried||[]).length ? `<p class="muted small">থিম চেষ্টা করেছে: ${p.themesTried.map(escapeHtml).join(', ')}</p>` : ''}
    ${(p.languagesUsed||[]).length ? `<p class="muted small">ভাষা ব্যবহার করেছে: ${p.languagesUsed.map(escapeHtml).join(', ')}</p>` : ''}

    <h4>দৈনিক পড়ার লগ (সাম্প্রতিক ৩০ দিন)</h4>
    <div class="activity-log">
      ${activityEntries.length ? activityEntries.map(([date, sec]) => `
        <div class="activity-row">
          <span class="activity-date">${escapeHtml(date)}</span>
          <span class="activity-bar-wrap"><span class="activity-bar" style="width:${Math.min(100, Math.round((sec/1800)*100))}%"></span></span>
          <span class="activity-min">${Math.round(sec/60)} মিনিট</span>
        </div>`).join('') : '<p class="muted small">কোনো রেকর্ড নেই</p>'}
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
      const ok = await showConfirm({
        title: 'সেশন মুছবেন?',
        message: 'এই সেশনটি মুছে ফেলবেন? এই ডিভাইস থেকে লগইন সেশনটি আর কার্যকর থাকবে না।',
        confirmText: 'মুছুন',
        danger: true,
      });
      if(!ok) return;
      setConfirmBusy(true);
      try{
        await deleteSession(row.dataset.uid, row.dataset.sid);
        showToast('সেশনটি মুছে ফেলা হয়েছে', 'success');
        openUserDrawer(uid);
      }catch(err){
        showToast('সেশন মুছতে ব্যর্থ হয়েছে', 'error');
      }finally{
        setConfirmBusy(false);
      }
    });
  });

  document.getElementById('deleteUserBtn').addEventListener('click', async () => {
    const ok = await showConfirm({
      title: 'ইউজার ডকুমেন্ট মুছবেন?',
      message: `${user.name || user.email} — এই ইউজারের Firestore ডকুমেন্ট স্থায়ীভাবে মুছে যাবে (Auth অ্যাকাউন্ট থাকবে)। এই কাজটি ফিরিয়ে নেওয়া যাবে না।`,
      confirmText: 'স্থায়ীভাবে মুছুন',
      danger: true,
    });
    if(!ok) return;
    setConfirmBusy(true);
    try{
      await deleteUserDoc(uid);
      cachedUsers = cachedUsers.filter(u => u.id !== uid);
      closeUserDrawer();
      renderUsers();
      showToast('ইউজার ডকুমেন্ট মুছে ফেলা হয়েছে', 'success');
    }catch(err){
      showToast('ইউজার মুছতে ব্যর্থ হয়েছে', 'error');
    }finally{
      setConfirmBusy(false);
    }
  });
}

function closeUserDrawer(){
  document.getElementById('userDrawer').classList.add('hidden');
}
document.getElementById('closeDrawerBtn')?.addEventListener('click', closeUserDrawer);
