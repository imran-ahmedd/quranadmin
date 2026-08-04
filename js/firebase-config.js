// ---------- Firebase project config (Admin Control Room) ----------
// এইটা মূল AlQuran অ্যাপের মতোই একই Firebase প্রজেক্ট — কারণ এডমিন
// রিপোকে সেই একই ডেটাবেস (users, sessions, system_errors) পড়তে হবে।
// আলাদা কোনো Firebase প্রজেক্ট বানানোর দরকার নেই।
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCZXiL61tFvvjLD8PyWppskbvC2H9pI32w",
  authDomain: "quranbangla2.firebaseapp.com",
  projectId: "quranbangla2",
  storageBucket: "quranbangla2.firebasestorage.app",
  messagingSenderId: "562329456797",
  appId: "1:562329456797:web:6f13a79c3b4b693a7b0474",
  measurementId: "G-C65WWC3WQQ"
};

firebase.initializeApp(FIREBASE_CONFIG);
const fbAuth = firebase.auth();
const fbDb = firebase.firestore();
