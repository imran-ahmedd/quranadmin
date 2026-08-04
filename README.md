# AlQuran Admin — কন্ট্রোল রুম

এটা একটা আলাদা রিপো/সাইট — AlQuran অ্যাপের (quranresource.vercel.app) জন্য
এডমিন ড্যাশবোর্ড। একই Firebase প্রজেক্ট (`quranbangla2`) ব্যবহার করে, তাই
আলাদা কোনো ব্যাকএন্ড সেটআপের দরকার নেই।

## এখানে কী আছে

- **ওভারভিউ** — মোট ইউজার, আজ/সপ্তাহে সক্রিয় ইউজার, গড় স্ট্রিক, মোট আয়াত
  পঠিত, আর গত ১৪ দিনের "সিস্টেম পালস" চার্ট (কোন দিন এরর হয়েছে সেটা লাল
  বিন্দু দিয়ে দেখায়)।
- **ইউজার ম্যানেজমেন্ট** — সব ইউজার সার্চ করে দেখা, প্রতি ইউজারের প্রগ্রেস
  ও লগইন সেশন হিস্টোরি দেখা, সেশন রিভোক করা, দরকার হলে ইউজার ডকুমেন্ট
  মুছে ফেলা।
- **এরর মনিটর** — অ্যাপে রিয়েল-টাইমে যা এরর হচ্ছে (JS এরর, ক্র্যাশ) সব এখানে
  লাল অ্যালার্ট আকারে আসে। সমাধান হয়ে গেলে "সমাধান হয়েছে" মার্ক করা যায়।

## সেটআপ — ৩টা ধাপ

### ১. নিজেকে এডমিন বানান
Firebase Console → Firestore Database → একটা নতুন কালেকশন বানান নাম
`admins`, তার ভেতরে আপনার নিজের Auth UID দিয়ে একটা ডকুমেন্ট বানান
(ফিল্ড খালি রাখলেও চলবে, বা `{ name: "আপনার নাম" }` দিতে পারেন)। UID
পাবেন Firebase Console → Authentication → Users থেকে, অথবা মূল অ্যাপে
লগইন করা অবস্থায় প্রোফাইল থেকে।

শুধু যাদের uid `admins` কালেকশনে আছে তারাই এই ড্যাশবোর্ডে ঢুকতে পারবে —
বাকি সব সাধারণ ইউজার "প্রবেশাধিকার নেই" পেজ দেখবে।

### ২. Firestore Rules আপডেট করুন
Firebase Console → Firestore → Rules-এ গিয়ে নিচেরটা বসান (মূল অ্যাপের
আগের rules-এর জায়গায়, বা তার সাথে মিলিয়ে):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAdmin() {
      return request.auth != null &&
        exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }

    match /admins/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false; // Console থেকে ম্যানুয়ালি যোগ/বাদ দিন
    }

    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      allow read, delete: if isAdmin(); // এডমিন প্যানেলের জন্য

      match /sessions/{sessionId} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
        allow read, delete: if isAdmin();
      }
    }

    match /system_errors/{errorId} {
      allow create: if true; // যেকোনো ইউজার (এমনকি লগইন না করা) এরর রিপোর্ট করতে পারবে
      allow read, update, delete: if isAdmin(); // শুধু এডমিন পড়তে/মুছতে পারবে
    }
  }
}
```

### ৩. মূল অ্যাপে এরর-লগার যোগ করুন
এডমিন প্যানেলের "এরর মনিটর" পেজ তখনই ডেটা দেখাবে যখন মূল অ্যাপ নিজে
সমস্যা রিপোর্ট করবে। `admin-additions/js/error-logger.js` ফাইলটা মূল
AlQuran রিপোর জন্য বানানো — সেটা কপি করে মূল রিপোর `js/` ফোল্ডারে রাখুন,
আর `index.html`-এ `js/firebase-config.js`-এর ঠিক পরে এই লাইনটা যোগ করুন:

```html
<script src="js/error-logger.js" defer></script>
```

এরপর থেকে অ্যাপে যেকোনো অপ্রত্যাশিত JS এরর বা ক্র্যাশ হলে সেটা এই এডমিন
প্যানেলে লাল অ্যালার্ট হয়ে চলে আসবে।

## ডিপ্লয় করা
এটা মূল অ্যাপের মতোই ভ্যানিলা JS static সাইট — কোনো বিল্ড স্টেপ নেই।
Vercel-এ নতুন একটা প্রজেক্ট হিসেবে এই ফোল্ডারটা (বা এই রিপো) যোগ করলেই
চলবে, ঠিক যেভাবে মূল AlQuran অ্যাপ ডিপ্লয় করা আছে।

> 💡 চাইলে এই এডমিন সাইটে পাসওয়ার্ড-প্রোটেক্টেড একটা কাস্টম সাব-ডোমেইন
> ব্যবহার করুন (যেমন `admin.quranresource.com`), যাতে এটা সহজে খুঁজে না
> পাওয়া যায়।

## বড় হলে মনে রাখবেন
এখন ওভারভিউ পেজ সব ইউজার একসাথে লোড করে ক্লায়েন্ট-সাইডে হিসাব করে —
কয়েক হাজার ইউজার পর্যন্ত ঠিক আছে। ইউজার সংখ্যা অনেক বেড়ে গেলে ভবিষ্যতে
একটা Cloud Function দিয়ে প্রতিদিন aggregate stats একটা আলাদা
`daily_stats` ডকুমেন্টে জমা রাখা ভালো হবে, যাতে ড্যাশবোর্ড পুরো ইউজার
লিস্ট না টেনে শুধু ঐ সামারি পড়ে।
