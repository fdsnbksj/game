import { FirebaseError } from 'firebase/app';
import {
  EmailAuthProvider,
  linkWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth } from '../firebase';
import { useGameStore } from '../store';

// Accounts. Everyone starts as an anonymous guest (src/services/auth.ts). Creating an
// account links an email and password to that same guest, so the uid, and everything
// kept under it (name, ladder), stays. Signing in instead switches to another uid;
// signing out goes back to a new guest.

/** Turns the current guest into an account, keeping its uid and progress. */
export async function createAccount(email: string, password: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not connected yet. Try again in a moment.');
  const linked = await linkWithCredential(user, EmailAuthProvider.credential(email.trim(), password));
  // The user is the same one, so no auth event fires: update the session by hand.
  useGameStore.getState().setEmail(linked.user.email);
}

/** Switches to an existing account. The guest's progress stays with the guest. */
export async function signIn(email: string, password: string) {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function signOut() {
  await firebaseSignOut(auth);
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email.trim());
}

/** A sentence for the player, from whatever Firebase threw. */
export function accountError(error: unknown): string {
  const code = error instanceof FirebaseError ? error.code : '';
  switch (code) {
    case 'auth/email-already-in-use':
    case 'auth/credential-already-in-use':
      return 'That email already has an account. Sign in instead.';
    case 'auth/invalid-email':
      return "That doesn't look like an email address.";
    case 'auth/missing-password':
    case 'auth/weak-password':
      return 'Use a password of at least 6 characters.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Wrong email or password.';
    case 'auth/too-many-requests':
      return 'Too many tries. Wait a minute and try again.';
    case 'auth/operation-not-allowed':
      return 'Accounts aren’t switched on yet. Try again later.';
    case 'auth/network-request-failed':
      return 'No connection. Try again when you’re online.';
    default:
      return error instanceof Error ? error.message : 'Something went wrong.';
  }
}
