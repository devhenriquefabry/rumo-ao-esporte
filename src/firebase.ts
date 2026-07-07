import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB5p94AGRA75Y8KsdAs1lgi4bmO_hcwcpM",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "rumo-ao-esporte.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "rumo-ao-esporte",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "rumo-ao-esporte.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "805204047919",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:805204047919:web:4d9ca4b500a99bb8836eda",
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-YNWT12CVBP"
};

const app = initializeApp(firebaseConfig);
export const analytics = isSupported().then((supported) => supported ? getAnalytics(app) : null);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
