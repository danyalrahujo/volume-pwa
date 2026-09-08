
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyDyijHPMZIIGkgfxnaDydwF-CHYBYj_v94",
  authDomain: "volume-c5c8d.firebaseapp.com",
  projectId: "volume-c5c8d",
  storageBucket: "volume-c5c8d.firebasestorage.app",
  messagingSenderId: "803553631311",
  appId: "1:803553631311:web:1583254b4e9a2383059e3a"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const messaging = getMessaging(app);