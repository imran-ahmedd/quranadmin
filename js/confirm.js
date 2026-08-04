// ---------- Custom confirm modal + toast (replaces native confirm()/alert()) ----------
// আগে সব delete/destructive অ্যাকশনে ব্রাউজারের নিজস্ব confirm() ডায়ালগ আসত
// ("localhost:xxxx says...") — এটা দেখতে খারাপ এবং থিমের সাথে যায় না।
// এখন থিমড, অ্যানিমেটেড মোডাল ব্যবহার হচ্ছে, প্লাস অ্যাকশন শেষে একটা টোস্ট
// যাতে ইউজার বুঝতে পারে কাজটা সফল হলো কিনা (আগে এটা সাইলেন্টলি হতো)।

let confirmOverlayEl = null;

function ensureConfirmModal(){
  if(confirmOverlayEl) return confirmOverlayEl;
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay hidden';
  overlay.innerHTML = `
    <div class="confirm-box" role="alertdialog" aria-modal="true" aria-labelledby="confirmTitle" aria-describedby="confirmMessage">
      <div class="confirm-icon"><i class="fa-solid fa-circle-question"></i></div>
      <h3 class="confirm-title" id="confirmTitle"></h3>
      <p class="confirm-message" id="confirmMessage"></p>
      <div class="confirm-actions">
        <button type="button" class="btn ghost confirm-cancel"></button>
        <button type="button" class="btn primary confirm-ok"></button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  confirmOverlayEl = overlay;
  return overlay;
}

/**
 * থিমড কনফার্ম বক্স দেখায়। ব্যবহার: await showConfirm({ message: '...' })
 * @returns {Promise<boolean>} true হলে ইউজার নিশ্চিত করেছে, false হলে বাতিল করেছে
 */
function showConfirm(options){
  const opts = typeof options === 'string' ? { message: options } : (options || {});
  const {
    title = 'নিশ্চিত করুন',
    message = '',
    confirmText = 'নিশ্চিত',
    cancelText = 'বাতিল',
    danger = false,
  } = opts;

  const overlay = ensureConfirmModal();
  const icon = overlay.querySelector('.confirm-icon');
  const okBtn = overlay.querySelector('.confirm-ok');
  const cancelBtn = overlay.querySelector('.confirm-cancel');

  overlay.querySelector('.confirm-title').textContent = title;
  overlay.querySelector('.confirm-message').textContent = message;
  okBtn.textContent = confirmText;
  cancelBtn.textContent = cancelText;
  okBtn.className = 'btn confirm-ok ' + (danger ? 'danger' : 'primary');
  okBtn.disabled = false;
  icon.className = 'confirm-icon' + (danger ? ' danger' : '');
  icon.innerHTML = danger ? '<i class="fa-solid fa-trash"></i>' : '<i class="fa-solid fa-circle-question"></i>';

  document.body.classList.add('modal-open');
  overlay.classList.remove('hidden');
  // পরের ফ্রেমে .show যুক্ত করা হচ্ছে যাতে CSS ট্রানজিশন ট্রিগার হয়
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('show')));

  return new Promise((resolve) => {
    let settled = false;
    function cleanup(result){
      if(settled) return;
      settled = true;
      overlay.classList.remove('show');
      document.body.classList.remove('modal-open');
      setTimeout(() => overlay.classList.add('hidden'), 200);
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('mousedown', onBackdrop);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    }
    function onOk(){ cleanup(true); }
    function onCancel(){ cleanup(false); }
    function onBackdrop(e){ if(e.target === overlay) cleanup(false); }
    function onKey(e){
      if(e.key === 'Escape'){ cleanup(false); }
      if(e.key === 'Enter'){ cleanup(true); }
    }
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('mousedown', onBackdrop);
    document.addEventListener('keydown', onKey);
    setTimeout(() => okBtn.focus(), 60);
  });
}

/** কনফার্ম মোডালের OK বাটনে লোডিং স্পিনার দেখানোর হেল্পার (async কাজ চলাকালীন) */
function setConfirmBusy(busy){
  if(!confirmOverlayEl) return;
  const okBtn = confirmOverlayEl.querySelector('.confirm-ok');
  if(!okBtn) return;
  okBtn.disabled = busy;
  if(busy){
    okBtn.dataset.origText = okBtn.dataset.origText || okBtn.textContent;
    okBtn.innerHTML = '<i class="fa-solid fa-spinner"></i> চলছে...';
  }else if(okBtn.dataset.origText){
    okBtn.textContent = okBtn.dataset.origText;
  }
}

let toastWrapEl = null;
function ensureToastWrap(){
  if(toastWrapEl) return toastWrapEl;
  const wrap = document.createElement('div');
  wrap.className = 'toast-wrap';
  document.body.appendChild(wrap);
  toastWrapEl = wrap;
  return wrap;
}

/**
 * ছোট নন-ব্লকিং টোস্ট নোটিফিকেশন দেখায় (alert() এর বদলে)।
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 */
function showToast(message, type = 'success'){
  const wrap = ensureToastWrap();
  const iconMap = { success: 'circle-check', error: 'circle-exclamation', info: 'circle-info' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<i class="fa-solid fa-${iconMap[type] || iconMap.info}"></i><span></span>`;
  el.querySelector('span').textContent = message;
  wrap.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 240);
  }, 3200);
}

window.showConfirm = showConfirm;
window.setConfirmBusy = setConfirmBusy;
window.showToast = showToast;
