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
