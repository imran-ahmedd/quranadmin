// ---------- স্ট্যাটাস / স্টোরি মডারেশন page ----------
// মূল অ্যাপের WhatsApp-স্টাইল স্ট্যাটাস ফিচার (js/status.js) থেকে পোস্ট করা
// সব স্টোরি এখানে রিয়েল-টাইমে দেখা যায় — টেক্সট স্ট্যাটাসে খারাপ কিছু
// লিখলে সরাসরি মুছে ফেলা যায়, আর দরকার হলে সেই ইউজারকে সীমিত/ব্লকও করা
// যায় (ইউজার ম্যানেজমেন্ট পেজে নিয়ে যাওয়া হবে এক ক্লিকেই)।
let statusesFilter = 'all'; // all | text | ayah

function _confirm2(opts){
  if(typeof showConfirm === 'function') return showConfirm(opts);
  const msg = typeof opts === 'string' ? opts : opts.message;
  return Promise.resolve(window.confirm(msg));
}
function _toast2(msg, type){ if(typeof showToast === 'function') showToast(msg, type); }
function _busy2(state){ if(typeof setConfirmBusy === 'function') setConfirmBusy(state); }

function statusIsExpired(s){
  return typeof s.expiresAt === 'number' && s.expiresAt < Date.now();
}

function statusPreviewHtml(s){
  if(s.type === 'ayah'){
    return `
      <div class="story-ayah-preview">
        <div class="story-ayah-ref">${escapeHtml(s.surahName || '')} ${s.surah ? s.surah + ':' + s.ayah : ''}</div>
        <div class="story-ayah-arabic">${escapeHtml(s.arabic || '')}</div>
        ${s.translation ? `<div class="story-ayah-translation">${escapeHtml(s.translation)}</div>` : ''}
      </div>`;
  }
  return `<div class="story-text-preview" style="background:${s.bg || 'linear-gradient(160deg,#123A34,#0E3B36)'}">${escapeHtml(s.text || '')}</div>`;
}

function renderStatuses(){
  const list = document.getElementById('statusesList');
  if(!list) return;

  const now = Date.now();
  const filtered = cachedStatuses
    .filter(s => !statusIsExpired(s))
    .filter(s => statusesFilter === 'all' || s.type === statusesFilter)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  document.querySelectorAll('.story-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === statusesFilter));

  const countEl = document.getElementById('statusesLiveCount');
  if(countEl) countEl.textContent = filtered.length;

  if(filtered.length === 0){
    list.innerHTML = `<div class="empty-ok"><i class="fa-solid fa-circle-check"></i> এই মুহূর্তে কোনো লাইভ স্টোরি নেই।</div>`;
    return;
  }

  list.innerHTML = filtered.map(s => {
    const viewerCount = Object.keys(s.viewers || {}).length;
    const reactionCount = Object.keys(s.reactions || {}).length;
    const hoursLeft = Math.max(0, Math.round(((s.expiresAt || now) - now) / 3600000));
    return `
    <div class="story-card" data-id="${s.id}" data-uid="${escapeHtml(s.uid || '')}">
      <div class="story-top">
        <div class="story-avatar" style="background:${s.avatarColor || 'linear-gradient(135deg, var(--gold), var(--teal))'}">${escapeHtml((s.name || '?').charAt(0).toUpperCase())}</div>
        <div class="story-who">
          <div class="story-name">${escapeHtml(s.name || 'অজানা ইউজার')}</div>
          <div class="muted small">${formatTimeMs(s.createdAt)} · আর ${toBnNum(hoursLeft)} ঘণ্টা থাকবে</div>
        </div>
        <span class="story-type-badge story-type-${s.type}">${s.type === 'ayah' ? 'আয়াত' : 'টেক্সট'}</span>
      </div>

      ${statusPreviewHtml(s)}

      <div class="story-meta muted small">
        <span><i class="fa-solid fa-eye"></i> ${viewerCount}</span>
        <span><i class="fa-solid fa-heart"></i> ${reactionCount}</span>
      </div>

      <div class="story-actions">
        <button class="btn small ghost story-moderate-btn"><i class="fa-solid fa-user-shield"></i> ইউজার মডারেট করুন</button>
        <button class="btn small danger story-delete-btn"><i class="fa-solid fa-trash"></i> স্টোরি মুছুন</button>
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('.story-moderate-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const uid = e.target.closest('.story-card').dataset.uid;
      if(!uid) return;
      navigateTo('users');
      // ইউজার লিস্ট ক্যাশড না থাকলে ড্রয়ার খোলার আগে একটু অপেক্ষা করা হচ্ছে
      const openWhenReady = async () => {
        if(!cachedUsers){ try{ cachedUsers = await fetchAllUsers(); }catch(err){ return; } }
        if(cachedUsers.some(u => u.id === uid)) openUserDrawer(uid);
        else _toast2('এই ইউজারের প্রোফাইল ডকুমেন্ট খুঁজে পাওয়া যায়নি', 'error');
      };
      setTimeout(openWhenReady, 150);
    });
  });

  list.querySelectorAll('.story-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const card = e.target.closest('.story-card');
      const id = card.dataset.id;
      const ok = await _confirm2({
        title: 'স্টোরি মুছবেন?',
        message: 'এই স্টোরিটা সবার জন্য সাথে সাথে সরিয়ে ফেলা হবে। এই কাজটি ফিরিয়ে নেওয়া যাবে না।',
        confirmText: 'মুছুন',
        danger: true,
      });
      if(!ok) return;
      _busy2(true);
      try{
        await deleteStatusDoc(id);
        _toast2('স্টোরি মুছে ফেলা হয়েছে', 'success');
      }catch(err){
        _toast2('মুছতে ব্যর্থ হয়েছে', 'error');
      }finally{
        _busy2(false);
      }
    });
  });
}

function formatTimeMs(ms){
  if(typeof ms !== 'number') return '';
  return new Date(ms).toLocaleString('bn-BD', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function toBnNum(n){
  return String(n).replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[d]);
}

document.querySelectorAll('.story-filter-btn').forEach(b => {
  b.addEventListener('click', () => { statusesFilter = b.dataset.filter; renderStatuses(); });
});
