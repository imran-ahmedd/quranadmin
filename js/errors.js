// ---------- Error / incident monitor page ----------
let errorsFilter = 'open'; // open | all | resolved

function renderErrors(){
  const list = document.getElementById('errorsList');
  const filtered = cachedErrors.filter(e => {
    if(errorsFilter === 'open') return !e.resolved;
    if(errorsFilter === 'resolved') return !!e.resolved;
    return true;
  });

  document.querySelectorAll('.error-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === errorsFilter));

  if(filtered.length === 0){
    list.innerHTML = `<div class="empty-ok"><i class="fa-solid fa-circle-check"></i> এই তালিকায় কিছু নেই।</div>`;
    return;
  }

  list.innerHTML = filtered.map(e => `
    <div class="error-card ${e.resolved ? 'resolved' : 'open'} sev-${e.severity || 'error'}" data-id="${e.id}">
      <div class="error-top">
        <span class="sev-badge">${severityLabel(e.severity)}</span>
        <span class="error-page">${escapeHtml(e.page || 'অজানা পেজ')}</span>
        <span class="error-time">${formatTime(e.timestamp)}</span>
      </div>
      <div class="error-msg">${escapeHtml(e.message || '')}</div>
      ${e.stack ? `<pre class="error-stack">${escapeHtml((e.stack || '').slice(0, 500))}</pre>` : ''}
      <div class="error-meta muted small">${escapeHtml(e.userAgent || '')}</div>
      <div class="error-actions">
        ${!e.resolved ? `<button class="btn small resolve-btn"><i class="fa-solid fa-check"></i> সমাধান হয়েছে বলে চিহ্নিত করুন</button>` : ''}
        <button class="btn small danger delete-btn"><i class="fa-solid fa-trash"></i> মুছুন</button>
      </div>
    </div>`).join('');

  list.querySelectorAll('.resolve-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.closest('.error-card').dataset.id;
      try{
        await resolveError(id);
        showToast('সমাধান হয়েছে বলে চিহ্নিত করা হয়েছে', 'success');
      }catch(err){
        showToast('আপডেট করতে ব্যর্থ হয়েছে', 'error');
      }
    });
  });
  list.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.closest('.error-card').dataset.id;
      const ok = await showConfirm({
        title: 'লগ মুছবেন?',
        message: 'এই এরর লগটি স্থায়ীভাবে মুছে ফেলবেন?',
        confirmText: 'মুছুন',
        danger: true,
      });
      if(!ok) return;
      setConfirmBusy(true);
      try{
        await deleteErrorLog(id);
        showToast('লগটি মুছে ফেলা হয়েছে', 'success');
      }catch(err){
        showToast('লগ মুছতে ব্যর্থ হয়েছে', 'error');
      }finally{
        setConfirmBusy(false);
      }
    });
  });
}

function severityLabel(sev){
  if(sev === 'warning') return '⚠️ সতর্কতা';
  if(sev === 'fatal') return '🔴 মারাত্মক';
  return '🔴 এরর';
}

document.querySelectorAll('.error-filter-btn').forEach(b => {
  b.addEventListener('click', () => { errorsFilter = b.dataset.filter; renderErrors(); });
});

document.getElementById('clearResolvedBtn')?.addEventListener('click', async () => {
  const ok = await showConfirm({
    title: 'সব সমাধান হওয়া লগ মুছবেন?',
    message: 'সমাধান হয়েছে বলে চিহ্নিত সব এরর লগ একসাথে স্থায়ীভাবে মুছে ফেলা হবে।',
    confirmText: 'সব মুছুন',
    danger: true,
  });
  if(!ok) return;
  setConfirmBusy(true);
  try{
    await clearResolvedErrors(cachedErrors);
    showToast('সমাধান হওয়া সব লগ মুছে ফেলা হয়েছে', 'success');
  }catch(err){
    showToast('লগ মুছতে ব্যর্থ হয়েছে', 'error');
  }finally{
    setConfirmBusy(false);
  }
});
