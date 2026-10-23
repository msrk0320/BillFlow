import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, indexedDBLocalPersistence, GoogleAuthProvider } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const isConfigValid = 
  import.meta.env.VITE_FIREBASE_API_KEY && 
  import.meta.env.VITE_FIREBASE_API_KEY !== "AIzaSyDummyKey-ForLocalDevOnly" &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID;

let app = null;
let auth = null;
let googleProvider = null;
let db = null;

if (isConfigValid) {
  try {
    app = initializeApp(firebaseConfig);
    auth = Capacitor.isNativePlatform()
      ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
      : getAuth(app);
    googleProvider = new GoogleAuthProvider();
    // Offline cache: rides logged without signal are queued and synced later.
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
  } catch (err) {
    console.error("Firebase initialization failed:", err);
  }
} else {
  console.warn("Firebase config is missing or invalid. Check environment variables.");
}

export { auth, googleProvider, db, isConfigValid };
export default app;
