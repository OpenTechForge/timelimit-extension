import { configureStore } from '@reduxjs/toolkit';
import { rootReducer } from './reducers';
import thunk from 'redux-thunk';
import { getDatabase, ref, update, onValue, set, serverTimestamp, off } from 'firebase/database';
import {
  initializeFirebaseSync,
  setActiveTab,
  updateActiveTabTimer,
  loadSettings,
  setSyncCode,
  setSyncEnabled,
  setSyncInitialized,
  syncToFirebase
} from './actions';
import { AppState } from './types';

// Store setup
const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware(),
  devTools: process.env.NODE_ENV !== 'production',
});

export default store;

// Manage ports (Map to track tabs and associated ports)
const ports = new Map<number, chrome.runtime.Port>();

// Listen for incoming connections from content scripts
chrome.runtime.onConnect.addListener((port) => {
  const tabId = Number(port.name); // Assuming the port name is set as the tabId
  if (!isNaN(tabId)) {
    ports.set(tabId, port);

    // Handle messages from the port
    port.onMessage.addListener((msg) => {
      if (msg.action === 'getTimeLeft') {
        const state: AppState = store.getState();
        const domain = getDomain(port.sender?.tab?.url || '');
        if (domain && domain !== state.activeTabDomain) {
          store.dispatch(setActiveTab(tabId, domain));
        }

        const { leastTimeLeft } = getLeastTimeLeft(state);
        port.postMessage({ action: 'updateTimer', timeLeft: leastTimeLeft });
      }

      if (msg.action === 'getShowTimer') {
        const state: AppState = store.getState();
        port.postMessage({ action: 'updateShowTimer', showTimer: state.showTimer });
      }
    });

    // Handle port disconnection
    port.onDisconnect.addListener(() => {
      ports.delete(tabId);
    });
  }
});

// Helper function to extract the domain from a URL
function getDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    console.error('Invalid URL:', url, error);
    return null;
  }
}

// Sync settings to Firebase
setInterval(() => {
  const state: AppState = store.getState();
  const now = Date.now();
  const secondsPassedSinceUpdate = (now - state.lastUpdateTime) / 1000;

  if (state.syncEnabled && state.syncInitialized) {
    store.dispatch(syncToFirebase())
      .catch((error) => {
        console.error('Error syncing to Firebase:', error);
      });
  }
}, 1000);

// Listen for tab activation
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    store.dispatch(setActiveTab(tab.id, getDomain(tab.url)));
    store.dispatch(updateActiveTabTimer());
  });
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    store.dispatch(setActiveTab(tab.id, getDomain(tab.url)));
    store.dispatch(updateActiveTabTimer());
  }
});

// Initialize Firebase Sync when the extension starts
store.dispatch(loadSettings()).then(() => {
  const state: AppState = store.getState();
  if (state.syncEnabled) {
    store.dispatch(initializeFirebaseSync());
  }
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const state: AppState = store.getState();

  if (request.action === 'updateSettings') {
    store.dispatch(updateStorage())
      .then(() => {
        console.log('Settings updated successfully');
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error('Error updating settings:', error);
        sendResponse({ success: false, error });
      });
    return true;
  }

  if (request.action === 'syncCodeGenerated') {
    const syncCode = request.syncCode;
    store.dispatch(setSyncCode(syncCode));
    store.dispatch(setSyncEnabled(true));
    store.dispatch(initializeFirebaseSync());
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'signOut') {
    // Clear sync state and disable sync
    store.dispatch(setSyncEnabled(false));
    store.dispatch(setSyncCode(''));
    store.dispatch(setSyncInitialized(false));
    sendResponse({ success: true });
    return true;
  }

  return false;
});

console.log('Background script initialized.');
