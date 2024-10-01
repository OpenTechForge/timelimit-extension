// background.js

// Access Redux and Redux Thunk
const { createStore, applyMiddleware, compose } = Redux;
const thunk = ReduxThunk;

// Initialize variables
let ports = new Map();
let lastFirebaseUpdateTime = 0;

// Initialize Firebase
// firebase.initializeApp(firebaseConfig);
const database = firebase.database();
// console.log('Firebase initialized');

// Create the Redux store
const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
const store = createStore(rootReducer, composeEnhancers(applyMiddleware(thunk)));

function getDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    console.error('Invalid URL:', url, error);
    return null;
  }
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  let formattedTime = [];

  if (hours > 0) {
    formattedTime.push(`${hours}h`);
  }

  if (minutes > 0 || (hours > 0 && remainingSeconds > 0)) {
    formattedTime.push(`${minutes}m`);
  }

  if (remainingSeconds > 0 || formattedTime.length === 0) {
    formattedTime.push(`${remainingSeconds}s`);
  }

  return formattedTime.join(' ');
}

// Listener for content scripts
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'timerPort') {
    const tabId = port.sender.tab.id;
    ports.set(tabId, port);

    port.onMessage.addListener((msg) => {
      if (msg.action === 'getTimeLeft') {
        const domain = getDomain(port.sender.tab.url);
        const state = store.getState();
        if (domain !== state.activeTabDomain) {
          store.dispatch(setActiveTab(tabId, domain));
        }
        const { leastTimeLeft } = getLeastTimeLeft();
        port.postMessage({ action: 'updateTimer', timeLeft: leastTimeLeft });
      } else if (msg.action === 'getShowTimer') {
        const state = store.getState();
        port.postMessage({ action: 'updateShowTimer', showTimer: state.showTimer });
      }
    });

    port.onDisconnect.addListener(() => {
      ports.delete(tabId);
    });
  }
});

// Listener for tab activation
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    store.dispatch(setActiveTab(tab.id, getDomain(tab.url)));
    store.dispatch(updateActiveTabTimer());
  });
});

// Listener for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    store.dispatch(setActiveTab(tab.id, getDomain(tab.url)));
    store.dispatch(updateActiveTabTimer());
  }
});

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'syncCodeGenerated') {
    const syncCode = request.syncCode;
    console.log('Received sync code from content script:', syncCode);

    // Save the sync code and enable sync
    store.dispatch(setSyncCode(syncCode));
    store.dispatch(setSyncEnabled(true));

    // Update storage
    browser.storage.sync.set({ syncCode: syncCode, syncEnabled: true }, function() {
      // Initialize synchronization
      store.dispatch(initializeFirebaseSync())
        .then(() => {
          console.log('Sync initialized with new sync code');
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error('Error initializing Firebase sync:', error);
          sendResponse({ success: false, error: error.message });
        });
    });
    return true; // Indicates response will be sent asynchronously
  }
  else if (request.action === 'signInWithGoogle') {
    signInWithGoogle()
      .then((result) => {
        const uid = result.user.uid;
        const userRef = database.ref('users/' + uid);

        userRef
          .once('value')
          .then((snapshot) => {
            if (snapshot.exists() && snapshot.val().syncCode) {
              // Existing user with syncCode
              const syncCode = snapshot.val().syncCode;
              console.log('Existing sync code retrieved:', syncCode);
              return syncCode;
            } else {
              // New user, generate syncCode
              const syncCode = generateRandomCode(40);
              console.log('Generated new sync code:', syncCode);

              // Atomic update to prevent syncCode overwriting
              const updates = {};
              updates['/users/' + uid + '/syncCode'] = syncCode;
              updates['/syncCodes/' + syncCode + '/uid'] = uid;

              return database
                .ref()
                .update(updates)
                .then(() => syncCode)
                .catch((error) => {
                  console.error('Error saving sync code:', error);
                  throw error;
                });
            }
          })
          .then((syncCode) => {
            // Store sync code locally and proceed
            store.dispatch(setSyncCode(syncCode));
            store.dispatch(setSyncEnabled(true));
            store.dispatch(setSyncInitialized(true));

            chrome.storage.sync.set({ syncCode: syncCode, syncEnabled: true }, () => {
              // Initialize synchronization
              store.dispatch(initializeFirebaseSync()).then(() => {
                sendResponse({ success: true, user: result.user, syncCode: syncCode });
              });
            });
          })
          .catch((error) => {
            console.error('Error during sign-in process:', error);
            sendResponse({ success: false, error: error.message });
          });
      })
      .catch((error) => {
        console.error('Sign-in failed:', error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Keep the message channel open for sendResponse
  } else if (request.action === 'signOut') {
    firebase
      .auth()
      .signOut()
      .then(() => {
        store.dispatch(setSyncCode(''));
        store.dispatch(setSyncEnabled(false));
        store.dispatch(setSyncInitialized(false));
        chrome.storage.sync.set({ syncCode: '', syncEnabled: false });
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error('Sign-out failed:', error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Keep the message channel open for sendResponse
  } else if (request.action === 'applySyncCode') {
    const syncCode = request.syncCode;
    if (syncCode.length !== 40) {
      sendResponse({ success: false, error: 'Invalid Sync Code' });
      return;
    }

    store.dispatch(setSyncCode(syncCode));
    store.dispatch(setSyncEnabled(true));

    chrome.storage.sync.set({ syncCode: syncCode, syncEnabled: true }, () => {
      store
        .dispatch(initializeFirebaseSync())
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
    });

    return true;
  } else if (request.action === 'updateSettings') {
    console.log('Updating settings');
    const currentState = store.getState();

    // Merge the incoming settings with the current settings
    const mergedSettings = mergeUpdates(currentState.settings, request.settings);

    // Dispatch action to update the store with the merged settings
    store.dispatch(setSettings(mergedSettings));

    store.dispatch(updateStorage()).then(() => {
      store.dispatch(updateActiveTabTimer());
      console.log('Settings updated successfully');
      sendResponse({ success: true });
    });
  } else if (request.action === 'deleteDomainSet') {
    store.dispatch(deleteDomainSet(request.id))
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error('Error deleting domain set:', error);
        sendResponse({ success: false, error: 'Failed to delete domain set' });
      });
  } else if (request.action === 'addDomainSet') {
    store.dispatch(addDomainSet(request.set))
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error }));
  } else if (request.action === 'resetTimer') {
    store.dispatch(resetTimer(request.setId))
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error('Error resetting timer:', error);
        sendResponse({ success: false, error: 'Failed to reset timer' });
      });
  } else if (request.action === 'extendTime') {
    store.dispatch(extendTime(request.domain, request.minutes))
      .then(() => sendResponse({ success: true }))
      .catch((error) => {
        console.error('Error extending time:', error);
        sendResponse({ success: false, error: 'Failed to extend time' });
      });
  } else if (request.action === 'updateShowTimer') {
    store.dispatch(setShowTimer(request.showTimer));
    chrome.storage.sync.set({ showTimer: request.showTimer }, () => {
      ports.forEach((port) => {
        port.postMessage({ action: 'updateShowTimer', showTimer: request.showTimer });
      });
      console.log('Show timer setting updated successfully');
      sendResponse({ success: true });
    });
  } else if (request.action === 'getShowTimer') {
    const state = store.getState();
    sendResponse({ showTimer: state.showTimer });
  } else if (request.action === 'updateSyncSettings') {
    store.dispatch(applySyncSettingsUpdate(request.syncEnabled, request.syncCode))
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error }));
  } else if (request.action === 'getFullState') {
    const state = store.getState();
    sendResponse({
      settings: state.settings,
      syncEnabled: state.syncEnabled,
      syncCode: state.syncCode,
      showTimer: state.showTimer,
    });
  } else {
    console.warn('Unknown action received:', request.action);
  }
  return true; // Indicates that the response is sent asynchronously
});

// Single timer that updates every second
setInterval(() => {
  store.dispatch(updateActiveTabTimer());

  // Sync to Firebase no more than once per second
  const now = Date.now();
  if (now - lastFirebaseUpdateTime >= 1000) {
    const state = store.getState();
    if (state.syncEnabled && state.syncInitialized) {
      store.dispatch(syncToFirebase())
        .then(() => {
          lastFirebaseUpdateTime = now;
        })
        .catch((error) => {
          console.error('Error syncing to Firebase:', error);
        });
    }
  }
}, 1000);

// Load settings when the extension starts
store.dispatch(loadSettings()).then(() => {
  console.log('Settings loaded successfully');
}).catch((error) => {
  console.error('Error loading settings:', error);
});

console.log('Background script initialized');