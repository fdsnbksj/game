import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFirestoreEmulator as connectLiteEmulator, getFirestore as getLiteFirestore } from 'firebase/firestore/lite';

const env = import.meta.env;

export const app = initializeApp({
  // The emulators accept any API key.
  apiKey: env.VITE_FIREBASE_API_KEY ?? 'demo-api-key',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? 'demo-game',
  appId: env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(app);
export const db = getFirestore(app);
/**
 * The same database over plain HTTPS requests, one per read or write, with no stream to
 * stall. Friend fights write and double-check through it: on phones the main SDK's stream
 * can wedge after the app has been in the background, leaving a move pending forever.
 */
export const dbRest = getLiteFirestore(app);

if (env.VITE_USE_EMULATORS === 'true') {
  // Use the page's hostname so a phone opening the LAN URL reaches the emulators on this machine.
  const host = window.location.hostname;
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  connectLiteEmulator(dbRest, host, 8080);
}
