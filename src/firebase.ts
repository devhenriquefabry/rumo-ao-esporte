import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBy1Qyf-v0swTbrrBhSYRTRUPD-M45KUIA",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "arenasimonesia.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "arenasimonesia",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "arenasimonesia.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "76727417673",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:76727417673:web:a9f2c67f7383df60adf898",
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-B531FJ8FZ3"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
