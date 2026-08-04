// ---------- User management page ----------
let usersRenderedOnce = false;
let userStatusFilter = 'all'; // all | active | restricted | blocked

function userStatusInfo(status){
  const map = {
    active:     { label: 'সক্রিয়',   cls: 'status-active',     icon: 'circle-check' },
    restricted: { label: 'সীমিত',    cls: 'status-restricted', icon: 'triangle-exclamation' },
    blocked:    { label: 'ব্লক করা', cls: 'status-blocked',    icon: 'ban' },
  };
  return map[status] || map.active;
}
function statusBadge(status){
  const s = userStatusInfo(status || 'active');
  return `<span class="status-badge ${s.cls}"><i class="fa-solid fa-${s.icon}"></i> ${s.label}</span>`;
}

// সেফটি-নেট: কোনো কারণে confirm.js লোড না হলেও যেন ডিলিট বাটনগুলো
// একদম অকেজো হয়ে না যায় — নেটিভ confirm()-এ ফলব্যাক করবে।
function _confirm(opts){
  if(typeof showConfirm === 'function') return showConfirm(opts);
  const msg = typeof opts === 'string' ? opts : opts.message;
  return Promise.resolve(window.confirm(msg));
}
function _toast(msg, type){ if(typeof showToast === 'function') showToast(msg, type); }
function _busy(state){ if(typeof setConfirmBusy === 'function') setConfirmBusy(state); }

function userInitial(name, email){
  const src = (name || email || '?').trim();
  return src.charAt(0).toUpperCase();
}

async function renderUsers(){
  const tbody = document.getElementById('usersTbody');
  const searchInput = document.getElementById('userSearch');

  if(!cachedUsers){
    tbody.innerHTML = `<tr><td colspan="6" class="loading">লোড হচ্ছে...</td></tr>`;
    try{ cachedUsers = await fetchAllUsers(); }
    catch(e){ tbody.innerHTML = `<tr><td colspan="6" class="loading err">লোড ব্যর্থ হয়েছে</td></tr>`; return; }
  }

  const draw = () => {
    const q = (searchInput.value || '').trim().toLowerCase();
    const rows = cachedUsers
      .filter(u => !q || (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))
      .filter(u => userStatusFilter === 'all' || (u.status || 'active') === userStatusFilter)
      .sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));

    document.querySelectorAll('.status-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.statusFilter === userStatusFilter));

    if(rows.length === 0){
      tbody.innerHTML = `<tr><td colspan="6" class="loading">কোনো ইউজার পাওয়া যায়নি</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(u => `
      <tr data-uid="${u.id}" class="user-row">
        <td>${escapeHtml(u.name || '—')}</td>
        <td>${escapeHtml(u.email || '—')}</td>
        <td>${statusBadge(u.status)}</td>
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
    document.querySelectorAll('.status-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => { userStatusFilter = btn.dataset.statusFilter; draw(); });
    });
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
    <div class="drawer-header">
      <div class="drawer-avatar">${escapeHtml(userInitial(user.name, user.email))}</div>
      <div class="drawer-header-text">
        <h3>${escapeHtml(user.name || 'নাম নেই')}</h3>
        <p class="muted small">${escapeHtml(user.email || '')}${user.position ? ' · ' + escapeHtml(user.position) : ''}</p>
        <p class="muted small drawer-dates"><i class="fa-solid fa-calendar-plus"></i> যোগ দিয়েছেন: ${formatTime(user.createdAt) || '—'} &nbsp;·&nbsp; <i class="fa-solid fa-rotate"></i> শেষ সিঙ্ক: ${formatTime(user.updatedAt) || '—'}</p>
      </div>
    </div>

    <div class="mod-section">
      <h4><i class="fa-solid fa-user-shield"></i> অ্যাকাউন্ট নিয়ন্ত্রণ</h4>

      <div class="mod-status-row">
        <button class="mod-status-btn status-active${(user.status||'active')==='active'?' active':''}" data-status="active"><i class="fa-solid fa-circle-check"></i> সক্রিয়</button>
        <button class="mod-status-btn status-restricted${user.status==='restricted'?' active':''}" data-status="restricted"><i class="fa-solid fa-triangle-exclamation"></i> সীমিত</button>
        <button class="mod-status-btn status-blocked${user.status==='blocked'?' active':''}" data-status="blocked"><i class="fa-solid fa-ban"></i> ব্লক</button>
      </div>
      <p class="muted small mod-status-hint">
        <b>সীমিত:</b> লগইন করতে পারবে, কিন্তু নাম/পদবি/বায়ো পরিবর্তন করতে পারবে না।
        &nbsp;<b>ব্লক:</b> পরের বার অ্যাপ খুললেই স্বয়ংক্রিয়ভাবে সাইন-আউট হয়ে যাবে।
      </p>
      <textarea class="mod-reason-input" id="modReasonInput" placeholder="কারণ লিখুন (ইউজার এটা দেখতে পারবে না, শুধু এডমিন নোট)...">${escapeHtml(user.statusReason || '')}</textarea>
      <button class="btn small primary full" id="modStatusSaveBtn"><i class="fa-solid fa-floppy-disk"></i> স্ট্যাটাস সংরক্ষণ করুন</button>

      <div class="mod-theme-row">
        <div class="mod-theme-label">
          <i class="fa-solid fa-palette"></i>
          <div>
            <div>কাস্টম থিম অ্যাক্সেস</div>
            <p class="muted small">সাধারণত ৩০ দিনের স্ট্রিক লাগে — চালু করলে সাথে সাথে আনলক হয়ে যাবে</p>
          </div>
        </div>
        <label class="mod-toggle">
          <input type="checkbox" id="modThemeToggle"${user.customThemeGranted ? ' checked' : ''}>
          <span class="mod-toggle-slider"></span>
        </label>
      </div>

      <div class="mod-fields">
        <div class="mod-field-row" data-field="name">
          <div><span class="mod-field-label">নাম</span><p class="mod-field-value">${escapeHtml(user.name || '—')}</p></div>
          ${user.name ? `<button class="btn small ghost mod-clear-btn" data-field="name"><i class="fa-solid fa-eraser"></i> মুছুন</button>` : ''}
        </div>
        <div class="mod-field-row" data-field="position">
          <div><span class="mod-field-label">পদবি</span><p class="mod-field-value">${escapeHtml(user.position || '—')}</p></div>
          ${user.position ? `<button class="btn small ghost mod-clear-btn" data-field="position"><i class="fa-solid fa-eraser"></i> মুছুন</button>` : ''}
        </div>
        <div class="mod-field-row" data-field="bio">
          <div><span class="mod-field-label">বায়ো</span><p class="mod-field-value">${escapeHtml(user.bio || '—')}</p></div>
          ${user.bio ? `<button class="btn small ghost mod-clear-btn" data-field="bio"><i class="fa-solid fa-eraser"></i> মুছুন</button>` : ''}
        </div>
      </div>
    </div>

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

    ${(p.themesTried||[]).length || (p.languagesUsed||[]).length ? `
    <div class="meta-chip-groups">
      ${(p.themesTried||[]).length ? `
      <div class="meta-chip-row">
        <span class="meta-chip-label"><i class="fa-solid fa-palette"></i> থিম</span>
        <div class="meta-chip-list">${p.themesTried.map(t => `<span class="meta-chip">${escapeHtml(t)}</span>`).join('')}</div>
      </div>` : ''}
      ${(p.languagesUsed||[]).length ? `
      <div class="meta-chip-row">
        <span class="meta-chip-label"><i class="fa-solid fa-language"></i> ভাষা</span>
        <div class="meta-chip-list">${p.languagesUsed.map(l => `<span class="meta-chip">${escapeHtml(l)}</span>`).join('')}</div>
      </div>` : ''}
    </div>` : ''}

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
          <div class="session-icon"><i class="fa-solid fa-${s.deviceType === 'mobile' ? 'mobile-screen' : 'desktop'}"></i></div>
          <div class="session-meta">
            <div class="session-device">${escapeHtml(s.browser || 'অজানা ব্রাউজার')} · ${escapeHtml(s.os || '')}</div>
            <div class="muted small session-location"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(s.city || '')} ${escapeHtml(s.country || '')}</div>
            <div class="muted small session-time"><i class="fa-solid fa-clock"></i> ${formatTime(s.createdAt)}</div>
          </div>
          <button class="revoke-session" title="সেশন মুছুন" aria-label="সেশন মুছুন"><i class="fa-solid fa-xmark"></i></button>
        </div>`).join('') : '<p class="muted">কোনো সেশন রেকর্ড নেই</p>'}
    </div>
    <button class="btn danger full" id="deleteUserBtn"><i class="fa-solid fa-trash"></i> এই ইউজার ডকুমেন্ট মুছে ফেলুন</button>
  `;

  body.querySelectorAll('.revoke-session').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const row = e.target.closest('.session-row');
      const ok = await _confirm({
        title: 'সেশন মুছবেন?',
        message: 'এই সেশনটি মুছে ফেলবেন? এই ডিভাইস থেকে লগইন সেশনটি আর কার্যকর থাকবে না।',
        confirmText: 'মুছুন',
        danger: true,
      });
      if(!ok) return;
      _busy(true);
      try{
        await deleteSession(row.dataset.uid, row.dataset.sid);
        _toast('সেশনটি মুছে ফেলা হয়েছে', 'success');
        openUserDrawer(uid);
      }catch(err){
        _toast('সেশন মুছতে ব্যর্থ হয়েছে', 'error');
      }finally{
        _busy(false);
      }
    });
  });

  // ---- মডারেশন: স্ট্যাটাস বাটন (ক্লিকে শুধু ভিজ্যুয়াল সিলেক্ট হবে, আসল সেভ হবে নিচের বাটনে) ----
  let pendingStatus = user.status || 'active';
  body.querySelectorAll('.mod-status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      pendingStatus = btn.dataset.status;
      body.querySelectorAll('.mod-status-btn').forEach(b => b.classList.toggle('active', b.dataset.status === pendingStatus));
    });
  });

  document.getElementById('modStatusSaveBtn').addEventListener('click', async () => {
    const reason = document.getElementById('modReasonInput').value.trim();
    if(pendingStatus === 'blocked'){
      const ok = await _confirm({
        title: 'ইউজারকে ব্লক করবেন?',
        message: `${user.name || user.email} — পরের বার অ্যাপ খুললেই স্বয়ংক্রিয়ভাবে সাইন-আউট হয়ে যাবে। নিশ্চিত?`,
        confirmText: 'ব্লক করুন',
        danger: true,
      });
      if(!ok) return;
    }
    _busy(true);
    try{
      await updateUserStatus(uid, pendingStatus, reason);
      user.status = pendingStatus;
      user.statusReason = reason;
      const cu = cachedUsers.find(u => u.id === uid);
      if(cu){ cu.status = pendingStatus; cu.statusReason = reason; }
      _toast('স্ট্যাটাস আপডেট হয়েছে', 'success');
      renderUsers();
    }catch(err){
      _toast('স্ট্যাটাস আপডেট ব্যর্থ হয়েছে', 'error');
    }finally{
      _busy(false);
    }
  });

  // ---- কাস্টম থিম গ্রান্ট টগল ----
  document.getElementById('modThemeToggle').addEventListener('change', async (e) => {
    const granted = e.target.checked;
    try{
      await grantCustomTheme(uid, granted);
      user.customThemeGranted = granted;
      const cu = cachedUsers.find(u => u.id === uid);
      if(cu) cu.customThemeGranted = granted;
      _toast(granted ? 'কাস্টম থিম আনলক করা হয়েছে' : 'কাস্টম থিম অ্যাক্সেস বাতিল করা হয়েছে', 'success');
    }catch(err){
      e.target.checked = !granted;
      _toast('আপডেট ব্যর্থ হয়েছে', 'error');
    }
  });

  // ---- অনুপযুক্ত প্রোফাইল টেক্সট মুছে ফেলা (নাম/পদবি/বায়ো) ----
  body.querySelectorAll('.mod-clear-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const field = btn.dataset.field;
      const fieldLabel = { name: 'নাম', position: 'পদবি', bio: 'বায়ো' }[field] || field;
      const ok = await _confirm({
        title: `${fieldLabel} মুছবেন?`,
        message: `এই ইউজারের ${fieldLabel} ফিল্ডটা খালি করে দেওয়া হবে। ইউজার চাইলে আবার লিখতে পারবে।`,
        confirmText: 'মুছুন',
        danger: true,
      });
      if(!ok) return;
      _busy(true);
      try{
        await clearProfileField(uid, field);
        user[field] = '';
        const cu = cachedUsers.find(u => u.id === uid);
        if(cu) cu[field] = '';
        _toast(`${fieldLabel} মুছে ফেলা হয়েছে`, 'success');
        openUserDrawer(uid);
      }catch(err){
        _toast('মুছতে ব্যর্থ হয়েছে', 'error');
      }finally{
        _busy(false);
      }
    });
  });

  document.getElementById('deleteUserBtn').addEventListener('click', async () => {
    const ok = await _confirm({
      title: 'ইউজার ডকুমেন্ট মুছবেন?',
      message: `${user.name || user.email} — এই ইউজারের Firestore ডকুমেন্ট স্থায়ীভাবে মুছে যাবে (Auth অ্যাকাউন্ট থাকবে)। এই কাজটি ফিরিয়ে নেওয়া যাবে না।`,
      confirmText: 'স্থায়ীভাবে মুছুন',
      danger: true,
    });
    if(!ok) return;
    _busy(true);
    try{
      await deleteUserDoc(uid);
      cachedUsers = cachedUsers.filter(u => u.id !== uid);
      closeUserDrawer();
      renderUsers();
      _toast('ইউজার ডকুমেন্ট মুছে ফেলা হয়েছে', 'success');
    }catch(err){
      _toast('ইউজার মুছতে ব্যর্থ হয়েছে', 'error');
    }finally{
      _busy(false);
    }
  });
}

function closeUserDrawer(){
  document.getElementById('userDrawer').classList.add('hidden');
}
document.getElementById('closeDrawerBtn')?.addEventListener('click', closeUserDrawer);
