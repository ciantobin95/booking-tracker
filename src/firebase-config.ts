// Firebase web-app config. These values are PUBLIC identifiers by design —
// they only tell the SDK which project to talk to. Actual data protection is
// enforced server-side by Firebase Auth + firestore.rules, so committing this
// file to a public repo is safe. See docs/FIREBASE_SETUP.md for where to find
// your values.
export const firebaseConfig = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME.firebaseapp.com',
  projectId: 'REPLACE_ME',
  storageBucket: 'REPLACE_ME.firebasestorage.app',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
};

export function isFirebaseConfigured(): boolean {
  return !Object.values(firebaseConfig).some((v) => v.startsWith('REPLACE_ME'));
}
