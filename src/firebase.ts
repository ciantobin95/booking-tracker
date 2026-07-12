import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { firebaseConfig } from './firebase-config';

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

// Set VITE_EMULATORS=1 to run against local Firebase emulators (used by the
// automated smoke tests; never set in production builds).
const useEmulators = import.meta.env.VITE_EMULATORS === '1';

function ensureApp(): FirebaseApp {
  if (!app) {
    app = initializeApp(firebaseConfig);
  }
  return app;
}

export function auth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(ensureApp());
    if (useEmulators) {
      connectAuthEmulator(authInstance, 'http://127.0.0.1:9099', { disableWarnings: true });
    }
  }
  return authInstance;
}

export function db(): Firestore {
  if (!dbInstance) {
    if (useEmulators) {
      dbInstance = initializeFirestore(ensureApp(), {});
      connectFirestoreEmulator(dbInstance, '127.0.0.1', 8080);
    } else {
      // Persistent local cache = the calendar keeps working offline and
      // renders instantly from cache while fresh data syncs in.
      dbInstance = initializeFirestore(ensureApp(), {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      });
    }
  }
  return dbInstance;
}

export function watchAuth(callback: (user: User | null) => void): void {
  onAuthStateChanged(auth(), callback);
}

export async function signInWithGoogle(): Promise<void> {
  const a = auth();
  await setPersistence(a, browserLocalPersistence);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(a, provider);
  } catch (err: unknown) {
    // Popups are unreliable in installed/standalone PWAs (notably iOS);
    // fall back to the full-page redirect flow.
    const code = (err as { code?: string }).code ?? '';
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/operation-not-supported-in-this-environment'
    ) {
      await signInWithRedirect(a, provider);
    } else {
      throw err;
    }
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(auth());
}
