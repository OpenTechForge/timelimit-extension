const firebaseConfig = {
  apiKey: "AIzaSyDfaihMu38ZgydBJZQCpnfov3qqjSgW5nM",
  authDomain: "timelimit-extension.firebaseapp.com",
  databaseURL: "https://timelimit-extension-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "timelimit-extension",
  storageBucket: "timelimit-extension.appspot.com",
  messagingSenderId: "371863881692",
  appId: "1:371863881692:web:a69a8d95c9eefaf5d23119"
};

// Initialize Firebase app
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  const database = firebase.database();
  firebase.auth().signInAnonymously()
  .then(() => {
    console.log('Anonymous authentication successful');
    // Proceed with loading settings or other initialization
  })
  .catch((error) => {
    console.error('Anonymous authentication failed:', error);
  });

  console.log('Firebase initialized');
}
// Initialize Firebase
//const firebase = app.initializeApp(firebaseConfig);