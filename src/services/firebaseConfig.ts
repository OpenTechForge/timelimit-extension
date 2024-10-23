// firebase-config.ts

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

// Firebase configuration
export const firebaseConfig = {
  apiKey: 'AIzaSyDfaihMu38ZgydBJZQCpnfov3qqjSgW5nM',
  authDomain: 'timelimit-extension.firebaseapp.com',
  databaseURL: 'https://timelimit-extension-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'timelimit-extension',
  storageBucket: 'timelimit-extension.appspot.com',
  messagingSenderId: '371863881692',
  appId: '1:371863881692:web:a69a8d95c9eefaf5d23119',
};

export function initializeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Initialize Firebase app
      const app = initializeApp(firebaseConfig);

      // Initialize Firebase services
      const auth = getAuth(app);
      const database = getDatabase(app);

      // Anonymous sign-in
      signInAnonymously(auth)
        .then(() => {
          console.log('Anonymous authentication successful');
          console.log('Firebase initialized');
          resolve(); // Resolve the promise when sign-in is successful
        })
        .catch((error) => {
          console.error('Anonymous authentication failed:', error);
          reject(error); // Reject the promise if sign-in fails
        });
    } catch (error) {
      console.error('Firebase initialization error:', error);
      reject(error); // Reject the promise if there's any error during initialization
    }
  });
}
