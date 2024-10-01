// auth.js

function signInWithGoogle() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, function (token) {
      if (chrome.runtime.lastError || !token) {
        reject(chrome.runtime.lastError);
        return;
      }

      const credential = firebase.auth.GoogleAuthProvider.credential(null, token);

      firebase
        .auth()
        .signInWithCredential(credential)
        .then((result) => {
          resolve(result);
        })
        .catch((error) => {
          reject(error);
        });
    });
  });
}

// Expose the function to the background script
window.signInWithGoogle = signInWithGoogle;
