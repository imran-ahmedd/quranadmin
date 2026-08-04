// ---------- ছোট hash-router: overview / users / errors / sessions ----------
const VIEWS = ['overview', 'users', 'errors'];

function navigateTo(view){
  if(!VIEWS.includes(view)) view = 'overview';
  location.hash = view;
}

function renderView(){
  const view = (location.hash || '#overview').slice(1);
  const target = VIEWS.includes(view) ? view : 'overview';

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === target);
  });
  document.querySelectorAll('.view').forEach(el => {
    el.classList.toggle('hidden', el.id !== `view-${target}`);
  });

  if(target === 'overview' && typeof renderOverview === 'function') renderOverview();
  if(target === 'users' && typeof renderUsers === 'function') renderUsers();
  if(target === 'errors' && typeof renderErrors === 'function') renderErrors();
}

window.addEventListener('hashchange', renderView);

document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', () => navigateTo(el.dataset.view));
});
