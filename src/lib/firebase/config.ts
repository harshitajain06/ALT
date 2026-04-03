// src/lib/firebase/config.ts
"use client";

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from 'firebase/storage';

// Default bucket must match Firebase Console → Project settings → Storage (often *.appspot.com or *.firebasestorage.app).
const storageBucket =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
  "fir-authentication-8abb6.appspot.com";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBV2Q-_nJIcRHGUbhtwu8eKN9UAeaPvwQw",
  authDomain: "fir-authentication-8abb6.firebaseapp.com",
  projectId: "fir-authentication-8abb6",
  storageBucket,
  messagingSenderId: "854259513422",
  appId: "1:854259513422:web:9a3d38f04501b643f0ab1f"
};

// Initialize Firebase - check if already initialized to prevent errors in production
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export { app };


