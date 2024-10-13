import { getAuth, signInWithCredential, GoogleAuthProvider, UserCredential } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { firebaseConfig } from './firebase-config'; // Make sure you have firebaseConfig exported from your config file

// Initialize Firebase app if not already initialized
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export function signInWithGoogle(): Promise<UserCredential> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(chrome.runtime.lastError);
        return;
      }

      const credential = GoogleAuthProvider.credential(null, token);

      signInWithCredential(auth, credential)
        .then((result) => resolve(result))
        .catch((error) => reject(error));
    });
  });
}

// Expose the function to the background script
(window as any).signInWithGoogle = signInWithGoogle;
