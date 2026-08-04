// ---------- Admin login + guard ----------
// লগইন সেই একই Firebase Auth ইউজার দিয়ে হবে (AlQuran অ্যাপে যেই ইমেইল/
// পাসওয়ার্ড দিয়ে সাইন-আপ করা আছে)। কিন্তু শুধু সাইন-ইন করলেই ড্যাশবোর্ড
// খুলবে না — Firestore-এর admins/{uid} ডকুমেন্ট থাকলে তবেই খুলবে।
// এইভাবে সব ইউজার এডমিন প্যানেল দেখতে পারবে না, শুধু যাদের uid
// admins কালেকশনে যোগ করা আছে তারাই পারবে।

let currentAdmin = null;

const loginView = document.getElementById('loginView');
const deniedView = document.getElementById('deniedView');
const appShell = document.getElementById('appShell');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const loginBtn = document.getElementById('loginBtn');

function showOnly(el){
  [loginView, deniedView, appShell].forEach(v => v.classList.add('hidden'));
  el.classList.remove('hidden');
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPassword').value;
  loginBtn.disabled = true;
  loginBtn.textContent = 'যাচাই করা হচ্ছে...';
  try{
    await fbAuth.signInWithEmailAndPassword(email, pass);
    // onAuthStateChanged নিচে বাকি কাজ করবে
  }catch(err){
    loginError.textContent = mapAuthError(err);
  }finally{
    loginBtn.disabled = false;
    loginBtn.textContent = 'প্রবেশ করুন';
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  fbAuth.signOut();
});
document.getElementById('logoutBtnMobile')?.addEventListener('click', () => {
  fbAuth.signOut();
});

document.getElementById('backToLoginBtn')?.addEventListener('click', () => {
  fbAuth.signOut();
  showOnly(loginView);
});

function mapAuthError(err){
  const code = err && err.code;
  if(code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found')
    return 'ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।';
  if(code === 'auth/too-many-requests')
    return 'অনেকবার ভুল চেষ্টা হয়েছে — কিছুক্ষণ পর আবার চেষ্টা করুন।';
  return 'লগইন করা যায়নি — আবার চেষ্টা করুন।';
}

fbAuth.onAuthStateChanged(async (user) => {
  if(!user){
    currentAdmin = null;
    showOnly(loginView);
    return;
  }
  try{
    const adminDoc = await fbDb.collection('admins').doc(user.uid).get();
    if(!adminDoc.exists){
      showOnly(deniedView);
      return;
    }
    currentAdmin = { uid: user.uid, email: user.email, ...adminDoc.data() };
    document.getElementById('adminName').textContent = currentAdmin.name || user.email;
    showOnly(appShell);
    if(typeof onAdminReady === 'function') onAdminReady();
  }catch(err){
    console.error('Admin check failed:', err);
    showOnly(deniedView);
  }
});
