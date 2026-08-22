import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  type Firestore,
} from 'firebase/firestore';

// ── Config from Vite env ──────────────────────────────────────────────────
// Copy .env.example to .env and paste the values from:
// Firebase Console → Project settings → Your apps → Web app → SDK setup
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

function isPlaceholder(v: string | undefined): boolean {
  return !v || v.includes('your-') || v.includes('YOUR_') || v.trim() === '';
}

// The app is fully usable offline/local-only when Firebase is not set up,
// so every cloud feature is gated behind this flag.
export const firebaseConfigured = Boolean(
  !isPlaceholder(firebaseConfig.apiKey) &&
  !isPlaceholder(firebaseConfig.projectId) &&
  !isPlaceholder(firebaseConfig.appId)
);

let app: FirebaseApp | null = null;
let firestore: Firestore | null = null;

if (firebaseConfigured) {
  app = initializeApp(firebaseConfig);
  try {
    // Persistent IndexedDB cache keeps cloud reads available offline and
    // survives reloads. Multi-tab manager avoids the single-tab lock error.
    firestore = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    // Private browsing / unsupported storage — fall back to in-memory cache.
    firestore = getFirestore(app);
  }
}

// ── Optional App Check ────────────────────────────────────────────────────
// The study runs without user sign-in, so Firestore rules alone would leave
// the collection readable by anyone holding the (public) web config. App Check
// closes that gap by attesting that requests come from *this* app — it is app
// attestation, not user authentication, so nurses still never log in.
// Leave VITE_FIREBASE_APPCHECK_SITE_KEY unset to skip it entirely.
const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;

export const appCheckEnabled = Boolean(app && !isPlaceholder(appCheckSiteKey));

if (app && appCheckEnabled) {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey as string),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    console.warn('[firebase] App Check failed to initialise', err);
  }
}

export const firebaseApp = app;
export const db = firestore;

// Firestore collection holding one document per completed assessment.
export const RECORDS_COLLECTION = 'assessment_records';
