// ---------- Data layer: sob Firestore query ekhane ----------

async function fetchAllUsers(){
  const snap = await fbDb.collection('users').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function todayStr(offsetDays = 0){
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}

function minutesFromSeconds(sec){ return Math.round((sec || 0) / 60); }

// ইউজারদের progress.activity ম্যাপ ({ "YYYY-MM-DD": seconds }) থেকে
// শেষ N দিনের মোট পড়ার সময় ও সক্রিয় ইউজার সংখ্যা বের করা হয়।
function aggregateDailyActivity(users, days = 14){
  const out = [];
  for(let i = days - 1; i >= 0; i--){
    const date = todayStr(i);
    let totalSeconds = 0, activeUsers = 0;
    users.forEach(u => {
      const sec = u.progress?.activity?.[date];
      if(sec){ totalSeconds += sec; activeUsers++; }
    });
    out.push({ date, minutes: minutesFromSeconds(totalSeconds), activeUsers });
  }
  return out;
}

function computeOverview(users){
  const today = todayStr(0);
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);

  let activeToday = 0, activeWeek = 0, newToday = 0, newWeek = 0;
  let totalStreak = 0, streakCount = 0, totalAyahs = 0, totalSurahsListened = 0;

  users.forEach(u => {
    const act = u.progress?.activity || {};
    if(act[today]) activeToday++;
    const activeInWeek = Object.keys(act).some(d => {
      const dt = new Date(d);
      return dt >= weekAgo;
    });
    if(activeInWeek) activeWeek++;

    const created = u.createdAt?.toDate ? u.createdAt.toDate() : null;
    if(created){
      if(created.toISOString().slice(0,10) === today) newToday++;
      if(created >= weekAgo) newWeek++;
    }

    if(typeof u.progress?.bestStreak === 'number'){ totalStreak += u.progress.bestStreak; streakCount++; }
    totalAyahs += u.progress?.ayahsReadCount || 0;
    totalSurahsListened += u.progress?.audioSurahsPlayedCount || 0;
  });

  return {
    totalUsers: users.length,
    activeToday, activeWeek, newToday, newWeek,
    avgBestStreak: streakCount ? Math.round(totalStreak / streakCount) : 0,
    totalAyahsRead: totalAyahs,
    totalSurahsListened
  };
}

async function fetchSessions(uid){
  const snap = await fbDb.collection('users').doc(uid).collection('sessions')
    .orderBy('createdAt', 'desc').limit(20).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function deleteSession(uid, sessionId){
  await fbDb.collection('users').doc(uid).collection('sessions').doc(sessionId).delete();
}

async function deleteUserDoc(uid){
  await fbDb.collection('users').doc(uid).delete();
}

// ---------- Moderation: account status + custom theme grant ----------
// status field on users/{uid} (missing/'active' = normal):
//   active     -> স্বাভাবিক, কোনো বাধা নেই
//   restricted -> লগইন করতে পারবে, কিন্তু নাম/পদবি/বায়ো (প্রোফাইল টেক্সট)
//                 এডিট করতে পারবে না, যতক্ষণ না আবার সক্রিয় করা হয়
//   blocked    -> পরের বার অ্যাপ খুললেই স্বয়ংক্রিয়ভাবে সাইন-আউট হয়ে যাবে
// মূল অ্যাপের js/auth.js এই ফিল্ডটা পড়ে enforcement করে — এটা শুধু
// ফিল্ড লেখে, বাকিটা মূল অ্যাপের দায়িত্ব।
async function updateUserStatus(uid, status, reason){
  await fbDb.collection('users').doc(uid).set({
    status,
    statusReason: reason || '',
    statusUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

// কাস্টম থিম বিল্ডার সাধারণত ৩০ দিনের স্ট্রিক ছাড়া আনলক হয় না (দেখুন
// AlQuran-main/js/theme-builder.js)। এডমিন এই ফ্ল্যাগ সেট করলে সেই শর্ত
// বাইপাস হয়ে যাবে — যে কাউকে সরাসরি অ্যাক্সেস দেওয়া যাবে।
async function grantCustomTheme(uid, granted){
  await fbDb.collection('users').doc(uid).set({ customThemeGranted: !!granted }, { merge: true });
}

// প্রোফাইলের একটা ফ্রি-টেক্সট ফিল্ড (নাম/পদবি/বায়ো) মুছে ফেলার জন্য —
// অনুপযুক্ত লেখা পেলে বাকি ডকুমেন্টে হাত না দিয়ে শুধু ওই ফিল্ডটাই ক্লিয়ার
// করা যায়।
async function clearProfileField(uid, field){
  const ALLOWED = ['name', 'position', 'bio'];
  if(!ALLOWED.includes(field)) throw new Error('field not allowed: ' + field);
  await fbDb.collection('users').doc(uid).update({ [field]: '' });
}

// ---------- স্ট্যাটাস / স্টোরি মডারেশন (WhatsApp-স্টাইল, js/status.js) ----------
// লাইভ (এখনো এক্সপায়ার হয়নি এমন) সব স্ট্যাটাস রিয়েল-টাইমে দেখা ও দরকার
// হলে মুছে ফেলার জন্য। Firestore rules-এ isAdmin()-কে delete পারমিশন আগে
// থেকেই দেওয়া আছে (js/status.js-এ ডকুমেন্টেড rules দেখুন)।
let unsubscribeStatuses = null;

function listenStatuses(callback){
  if(unsubscribeStatuses) unsubscribeStatuses();
  unsubscribeStatuses = fbDb.collection('statuses')
    .orderBy('createdAt', 'desc')
    .limit(300)
    .onSnapshot(snap => {
      const statuses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(statuses);
    }, err => {
      console.error('Status listener failed:', err);
      callback([], err);
    });
}

async function deleteStatusDoc(id){
  await fbDb.collection('statuses').doc(id).delete();
}

// ---------- Error / incident log ----------
// main app-এর js/error-logger.js এই কালেকশনে লেখে। এখানে শুধু পড়া/
// resolve করা/মুছে ফেলা হয়।
let unsubscribeErrors = null;

function listenErrors(callback){
  if(unsubscribeErrors) unsubscribeErrors();
  unsubscribeErrors = fbDb.collection('system_errors')
    .orderBy('timestamp', 'desc')
    .limit(200)
    .onSnapshot(snap => {
      const errors = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(errors);
    }, err => {
      console.error('Error log listener failed:', err);
      callback([], err);
    });
}

async function resolveError(id){
  await fbDb.collection('system_errors').doc(id).update({ resolved: true, resolvedAt: firebase.firestore.FieldValue.serverTimestamp() });
}

async function deleteErrorLog(id){
  await fbDb.collection('system_errors').doc(id).delete();
}

async function clearResolvedErrors(errors){
  const batch = fbDb.batch();
  errors.filter(e => e.resolved).forEach(e => batch.delete(fbDb.collection('system_errors').doc(e.id)));
  await batch.commit();
}
