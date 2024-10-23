import {
  initializeBackendSync,
  setActiveTab,
  updateActiveTabTimer,
  loadSettings,
  setSyncCode,
  setSyncEnabled,
  setSyncInitialized,
  syncToBackend,
  updateStorage,
  deleteDomainSet,
  addDomainSet,
  resetTimer,
  extendTime,
  setShowTimer,
  applySyncSettingsUpdate,
  setSettings,
  updateTimers
} from './actions';
import { getLeastTimeLeft, mergeUpdates } from './utils';
import store from './actions';
import { AppState } from './types';

export const ports = new Map<number, chrome.runtime.Port>();

// Listen for incoming connections from content scripts
chrome.runtime.onConnect.addListener((port) => {
  // Extract the tabId from the port's sender if available
  const tabId = port.sender?.tab?.id;
  
  if (tabId !== undefined) {
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
  } else {
    console.error('Failed to retrieve tabId from port sender');
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

// Update timers and sync settings to backend
setInterval(() => {
  const state: AppState = store.getState();

  store.dispatch(updateTimers())
    .then(() => { store.dispatch(updateActiveTabTimer()); })
    .catch((error) => {
    console.error('Error updating timers', error);
  });
}, 1000);

setInterval(() => {
  const state: AppState = store.getState();
  if (state.syncEnabled && state.syncInitialized) {
    store.dispatch(syncToBackend())
      .catch((error) => {
        console.error('Error syncing to backend:', error);
      });
  }
}, 5000);

// Listen for tab activation
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if(tab.id && tab.url)
    {
      const domain = getDomain(tab.url);
      if(domain)
      {
        store.dispatch(setActiveTab(tab.id, domain));
        store.dispatch(updateActiveTabTimer());
      }
    }
  });
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    if(tab.id && tab.url)
    {
      const domain = getDomain(tab.url);
      if(domain)
      {
        store.dispatch(setActiveTab(tab.id, domain));
        store.dispatch(updateActiveTabTimer());
      }
    }
  }
});

// Initialize backend Sync when the extension starts
store.dispatch(loadSettings()).then(() => {
  const state: AppState = store.getState();
  if (state.syncEnabled) {
    store.dispatch(initializeBackendSync());
  }
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const state: AppState = store.getState();

  if (request.action === 'updateSettings') {
    console.log('Updating settings');
    const currentState = store.getState();

    // Merge the incoming settings with the current settings
    const mergedSettings = mergeUpdates(currentState.settings, request.settings);

    // Dispatch action to update the store with the merged settings
    store.dispatch(setSettings(mergedSettings));

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
    store.dispatch(initializeBackendSync());
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'signOut') {
    store.dispatch(setSyncEnabled(false));
    store.dispatch(setSyncCode(''));
    store.dispatch(setSyncInitialized(false));
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'applySyncCode') {
    const syncCode = request.syncCode;
    if (syncCode.length !== 40) {
      sendResponse({ success: false, error: 'Invalid Sync Code' });
      return;
    }

    store.dispatch(setSyncCode(syncCode));
    store.dispatch(setSyncEnabled(true));

    chrome.storage.sync.set({ syncCode, syncEnabled: true }, () => {
      store.dispatch(initializeBackendSync())
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
    });

    return true;
  }

  if (request.action === 'deleteDomainSet') {
    store.dispatch(deleteDomainSet(request.id))
      .then(() => sendResponse({ success: true }))
      .catch((error) => {
        console.error('Error deleting domain set:', error);
        sendResponse({ success: false, error });
      });
    return true;
  }

  if (request.action === 'addDomainSet') {
    store.dispatch(addDomainSet(request.set))
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error }));
    return true;
  }

  if (request.action === 'resetTimer') {
    store.dispatch(resetTimer(request.setId))
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error }));
    return true;
  }

  if (request.action === 'extendTime') {
    store.dispatch(extendTime(request.domain, request.minutes))
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error }));
    return true;
  }

  if (request.action === 'updateShowTimer') {
    store.dispatch(setShowTimer(request.showTimer));
    store.dispatch(updateStorage(false))
      .then(() => {
        ports.forEach((port) => {
          port.postMessage({ action: 'updateShowTimer', showTimer: request.showTimer });
        });
        sendResponse({ success: true });
      })
      .catch((error) => sendResponse({ success: false, error }));
    return true;
  }

  if (request.action === 'getShowTimer') {
    sendResponse({ showTimer: state.showTimer });
    return true;
  }

  if (request.action === 'updateSyncSettings') {
    store.dispatch(applySyncSettingsUpdate(request.syncEnabled, request.syncCode))
      .then(() => {console.log('sending response to update sync settings');sendResponse({ success: true })})
      .catch((error) => sendResponse({ success: false, error }));
    return true;
  }

  if (request.action === 'getFullState') {
    console.log("Sending the full state", state);
    sendResponse({
      settings: state.settings,
      syncEnabled: state.syncEnabled,
      syncCode: state.syncCode,
      showTimer: state.showTimer,
    });
    return true;
  }

  console.warn('Unknown action received:', request.action);
  return true; // Indicates that the response is sent asynchronously
});

console.log('Background script initialized.');
