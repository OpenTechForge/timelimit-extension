// popup.js

let domainSets = {};
let globalBlocking = { enabled: false, schedule: [] };

// Initialize Firebase (assuming firebaseConfig is defined in firebase-config.js)
firebase.initializeApp(firebaseConfig);

// Get the Firebase Auth instance
const auth = firebase.auth();

// Google Auth Provider
const provider = new firebase.auth.GoogleAuthProvider();

// Handle sign-in success
function handleSignInSuccess(user) {
  document.getElementById('syncCodeContainer').style.display = 'block';

  // Send a message to background.js to fetch or generate the sync code
  chrome.runtime.sendMessage({ action: 'getSyncCode', uid: user.uid }, (response) => {
    if (response.success) {
      document.getElementById('syncCodeDisplay').value = response.syncCode;
    } else {
      console.error('Failed to get sync code:', response.error);
      alert('Failed to get sync code: ' + response.error);
    }
  });
}

// Handle sign-out success
function handleSignOutSuccess() {
  document.getElementById('syncCodeContainer').style.display = 'none';
  document.getElementById('syncCodeDisplay').value = '';
}

// Listen for authentication state changes
auth.onAuthStateChanged((user) => {
  if (user) {
    console.log('User is signed in:', user);
    handleSignInSuccess(user);
  } else {
    console.log('No user is signed in');
    handleSignOutSuccess();
  }
});

// Event listeners for sign-in and sign-out
document.getElementById('openAuthPage').addEventListener('click', () => {
  const authUrl = 'https://timelimit-extension.firebaseapp.com/auth.html';
  browser.tabs.create({ url: authUrl });
});

document.getElementById('copySyncCodeButton').addEventListener('click', () => {
  const syncCode = document.getElementById('syncCodeDisplay').value;
  navigator.clipboard.writeText(syncCode).then(() => {
    alert('Sync Code copied to clipboard!');
  });
});

// On load, check if the user is signed in (handled by auth.onAuthStateChanged)

// Function to render domain sets
function renderDomainSets() {
  console.log('Rendering domain sets in popup!');
  const container = document.getElementById('domainSets');
  container.innerHTML = '';

  Object.entries(domainSets).forEach(([id, set]) => {
    const div = document.createElement('div');
    div.className = 'domain-set';
    div.dataset.id = id;
    div.innerHTML = `
      <input type="text" value="${set.domains.join(',')}" placeholder="Domains (comma-separated)">
      <input type="text" value="${formatTime(set.timeLimit)}" placeholder="Time Limit (HH:MM:SS, 1h 30m, etc.)">
      <div class="controls">
        <label><input type="checkbox" ${set.strictMode ? 'checked' : ''}> Strict Mode</label>
        <button class="reset">Reset</button>
        <button class="delete">Delete</button>
        <span class="time-left">Time Left: ${formatTime(Math.max(0, set.timeLeft))}</span>
      </div>
    `;
    div.querySelector('.reset').addEventListener('click', () => resetTimer(id));
    div.querySelector('.delete').addEventListener('click', () => deleteDomainSet(id));
    container.appendChild(div);
  });
}

// Function to render global blocking settings
function renderGlobalBlocking() {
  document.getElementById('globalBlockingEnabled').checked = globalBlocking.enabled;
  if (globalBlocking.schedule && globalBlocking.schedule.length > 0) {
    document.getElementById('globalBlockingStart').value = globalBlocking.schedule[0].startTime;
    document.getElementById('globalBlockingEnd').value = globalBlocking.schedule[0].endTime;
  }
}

// Function to save domain sets
function saveDomainSets() {
  const sets = Array.from(document.querySelectorAll('.domain-set')).reduce((acc, div) => {
    const id = div.dataset.id;
    const domains = div.querySelector('input[type="text"]').value
      .split(',')
      .map((d) => d.trim())
      .filter((d) => d !== '');

    if (domains.length > 0) {
      const newTimeLimit = parseTime(div.querySelectorAll('input[type="text"]')[1].value);
      const oldSet = domainSets[id] || {};
      acc[id] = {
        ...oldSet,
        id: id,
        domains: domains,
        timeLimit: newTimeLimit,
        timeLeft: oldSet.timeLeft || newTimeLimit,
        strictMode: div.querySelector('input[type="checkbox"]').checked,
        lastResetDate: oldSet.lastResetDate || Date.now(),
        lastSessionStart: oldSet.lastSessionStart || 0,
        lastSessionEnd: oldSet.lastSessionEnd || 0,
        lastSessionActive: oldSet.lastSessionActive || false,
        timeSpent: oldSet.timeSpent || 0,
      };
    }

    return acc;
  }, {});

  chrome.runtime.sendMessage(
    {
      action: 'updateSettings',
      settings: {
        domainSets: sets,
        globalBlocking: globalBlocking,
        lastSettingsUpdateDate: Date.now(),
      },
    },
    () => {
      loadSettings();
    }
  );
}

// Function to delete a domain set
function deleteDomainSet(id) {
  chrome.runtime.sendMessage({ action: 'deleteDomainSet', id: id }, () => {
    loadSettings();
  });
}

// Function to add a new domain set
function addDomainSet() {
  const newSet = {
    id: Date.now().toString(),
    domains: [],
    timeLimit: 3600,
    timeLeft: 3600,
    strictMode: false,
    lastResetDate: Date.now(),
    lastSessionStart: 0,
    lastSessionEnd: 0,
    lastSessionActive: false,
    timeSpent: 0,
  };
  chrome.runtime.sendMessage({ action: 'addDomainSet', set: newSet }, () => {
    loadSettings();
  });
}

// Function to reset a timer
function resetTimer(setId) {
  chrome.runtime.sendMessage({ action: 'resetTimer', setId }, () => {
    loadSettings();
  });
}

// Function to parse time strings into seconds
function parseTime(timeString) {
  // Handle empty string
  if (!timeString.trim()) return 0;

  // Handle HH:MM:SS format
  const timeRegex = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
  const match = timeString.match(timeRegex);
  if (match) {
    const [, hours, minutes, seconds = 0] = match;
    return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
  }

  // Handle natural language format (e.g., 1h 30m, 45m, 2h)
  const parts = timeString.toLowerCase().match(/(\d+)\s*([hms])/g);
  if (parts) {
    return parts.reduce((total, part) => {
      const [, value, unit] = part.match(/(\d+)\s*([hms])/);
      switch (unit) {
        case 'h':
          return total + parseInt(value) * 3600;
        case 'm':
          return total + parseInt(value) * 60;
        case 's':
          return total + parseInt(value);
        default:
          return total;
      }
    }, 0);
  }

  // If all else fails, try to parse as seconds
  const seconds = parseInt(timeString);
  return isNaN(seconds) ? 0 : seconds;
}

// Function to format time in seconds into HH:MM:SS
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Function to save global blocking settings
function saveGlobalBlockingSettings() {
  const enabled = document.getElementById('globalBlockingEnabled').checked;
  const schedule = [
    {
      days: [0, 1, 2, 3, 4, 5, 6], // You might want to allow selecting specific days
      startTime: document.getElementById('globalBlockingStart').value,
      endTime: document.getElementById('globalBlockingEnd').value,
    },
  ];

  globalBlocking = { enabled, schedule };

  chrome.runtime.sendMessage(
    {
      action: 'updateSettings',
      settings: {
        globalBlocking: globalBlocking,
        domainSets: domainSets,
        lastSettingsUpdateDate: Date.now()
      },
    },
    (response) => {
      if (response.success) {
        console.log('Global blocking settings updated');
        loadSettings();
      }
    }
  );
}

// Function to save sync settings (if any additional sync settings are needed)
function saveSyncSettings() {
  console.log('Saving sync settings in popup!');
  const syncEnabled = document.getElementById('syncEnabled').checked;
  const syncCode = document.getElementById('syncCode').value;
  chrome.runtime.sendMessage(
    {
      action: 'updateSyncSettings',
      syncEnabled,
      syncCode,
    },
    () => {
      console.log('Saved sync settings in popup!');
    }
  );
}

function verifySyncCode() {
  const syncCode = document.getElementById('syncCode').value.trim();
  if (!syncCode) {
    alert('Please enter a valid sync code.');
    return;
  }

  // Call Cloud Function to verify sync code
  firebase.functions().httpsCallable('verifySyncCode')({ syncCode })
    .then((result) => {
      const customToken = result.data.customToken;
      return firebase.auth().signInWithCustomToken(customToken);
    })
    .then((userCredential) => {
      const user = userCredential.user;
      handleSignInSuccess(user);
    })
    .catch((error) => {
      console.error('Error verifying sync code:', error);
      alert('Error verifying sync code: ' + error.message);
    });
}

// Listen for messages from background.js (if needed)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'syncSettingsChanged') {
    loadSettings();
  }
});

// Function to load settings from background.js
function loadSettings() {
  chrome.runtime.sendMessage({ action: 'getFullState' }, (response) => {
    const settings = response.settings || {};
    domainSets = settings.domainSets || {};
    globalBlocking = settings.globalBlocking || { enabled: false, schedule: [] };
    document.getElementById('syncEnabled').checked = response.syncEnabled;
    document.getElementById('syncCode').value = response.syncCode || '';
    document.getElementById('showTimer').checked = response.showTimer || false;

    renderGlobalBlocking();
    renderDomainSets();
  });
}

// Event listeners for UI interactions
document.getElementById('addDomainSet').addEventListener('click', addDomainSet);
document.getElementById('saveSync').addEventListener('click', saveSyncSettings);
document.getElementById('domainSets').addEventListener('change', saveDomainSets);
document.getElementById('saveGlobalBlocking').addEventListener('click', saveGlobalBlockingSettings);
document.getElementById('showTimer').addEventListener('change', (e) => {
  chrome.runtime.sendMessage(
    {
      action: 'updateShowTimer',
      showTimer: e.target.checked,
    },
    () => {
      loadSettings();
    }
  );
});
document.getElementById('verifySyncCodeButton').addEventListener('click', verifySyncCode);

// Load settings when the popup is opened
loadSettings();
