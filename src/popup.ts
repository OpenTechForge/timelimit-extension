import { getAuth, GoogleAuthProvider, User, signInWithCustomToken, signInWithCredential } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { initializeApp } from 'firebase/app';
import { firebaseConfig } from './firebase-config'; // Assuming firebaseConfig is defined in firebase-config.ts

// Initialize Firebase App and Services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app);

let domainSets: { [key: string]: any } = {};
let globalBlocking: { enabled: boolean; schedule: any[] } = { enabled: false, schedule: [] };

// Google Auth Provider
const provider = new GoogleAuthProvider();

// Handle sign-in success
function handleSignInSuccess(user: User): void {
  const syncCodeContainer = document.getElementById('syncCodeContainer') as HTMLElement;
  syncCodeContainer.style.display = 'block';

  // Send a message to background.ts to fetch or generate the sync code
  chrome.runtime.sendMessage({ action: 'getSyncCode', uid: user.uid }, (response) => {
    if (response.success) {
      const syncCodeDisplay = document.getElementById('syncCodeDisplay') as HTMLInputElement;
      syncCodeDisplay.value = response.syncCode;
    } else {
      console.error('Failed to get sync code:', response.error);
      alert('Failed to get sync code: ' + response.error);
    }
  });
}

// Handle sign-out success
function handleSignOutSuccess(): void {
  const syncCodeContainer = document.getElementById('syncCodeContainer') as HTMLElement;
  syncCodeContainer.style.display = 'none';
  const syncCodeDisplay = document.getElementById('syncCodeDisplay') as HTMLInputElement;
  syncCodeDisplay.value = '';
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
const openAuthPageBtn = document.getElementById('openAuthPage') as HTMLElement;
openAuthPageBtn.addEventListener('click', () => {
  const authUrl = 'https://timelimit-extension.firebaseapp.com/auth.html';
  chrome.tabs.create({ url: authUrl });
});

const copySyncCodeButton = document.getElementById('copySyncCodeButton') as HTMLElement;
copySyncCodeButton.addEventListener('click', () => {
  const syncCode = (document.getElementById('syncCodeDisplay') as HTMLInputElement).value;
  navigator.clipboard.writeText(syncCode).then(() => {
    alert('Sync Code copied to clipboard!');
  });
});

// Function to render domain sets
function renderDomainSets(): void {
  console.log('Rendering domain sets in popup!');
  const container = document.getElementById('domainSets') as HTMLElement;
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
    div.querySelector('.reset')!.addEventListener('click', () => resetTimer(id));
    div.querySelector('.delete')!.addEventListener('click', () => deleteDomainSet(id));
    container.appendChild(div);
  });
}

// Function to render global blocking settings
function renderGlobalBlocking(): void {
  const globalBlockingEnabled = document.getElementById('globalBlockingEnabled') as HTMLInputElement;
  globalBlockingEnabled.checked = globalBlocking.enabled;
  if (globalBlocking.schedule && globalBlocking.schedule.length > 0) {
    const startTime = document.getElementById('globalBlockingStart') as HTMLInputElement;
    const endTime = document.getElementById('globalBlockingEnd') as HTMLInputElement;
    startTime.value = globalBlocking.schedule[0].startTime;
    endTime.value = globalBlocking.schedule[0].endTime;
  }
}

// Function to save domain sets
function saveDomainSets(): void {
  const sets = Array.from(document.querySelectorAll('.domain-set')).reduce<{ [key: string]: any }>((acc, div) => {
    const id = (div as HTMLElement).dataset.id!;
    const domains = (div.querySelector('input[type="text"]') as HTMLInputElement)
      .value.split(',')
      .map((d) => d.trim())
      .filter((d) => d !== '');

    if (domains.length > 0) {
      const newTimeLimit = parseTime((div.querySelectorAll('input[type="text"]')[1] as HTMLInputElement).value);
      const oldSet = domainSets[id] || {};
      acc[id] = {
        ...oldSet,
        id: id,
        domains: domains,
        timeLimit: newTimeLimit,
        timeLeft: oldSet.timeLeft || newTimeLimit,
        strictMode: (div.querySelector('input[type="checkbox"]') as HTMLInputElement).checked,
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
function deleteDomainSet(id: string): void {
  chrome.runtime.sendMessage({ action: 'deleteDomainSet', id: id }, () => {
    loadSettings();
  });
}

// Function to add a new domain set
function addDomainSet(): void {
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
function resetTimer(setId: string): void {
  chrome.runtime.sendMessage({ action: 'resetTimer', setId }, () => {
    loadSettings();
  });
}

// Function to parse time strings into seconds
function parseTime(timeString: string): number {
  if (!timeString.trim()) return 0;

  const timeRegex = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
  const match = timeString.match(timeRegex);
  if (match) {
    const [, hours, minutes, seconds = '0'] = match;
    return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
  }

  const parts = timeString.toLowerCase().match(/(\d+)\s*([hms])/g);
  if (parts) {
    return parts.reduce((total, part) => {
      const [, value, unit] = part.match(/(\d+)\s*([hms])/)!;
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

  const seconds = parseInt(timeString);
  return isNaN(seconds) ? 0 : seconds;
}

// Function to format time in seconds into HH:MM:SS
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds
    .toString()
    .padStart(2, '0')}`;
}

// Function to save global blocking settings
function saveGlobalBlockingSettings(): void {
  const enabled = (document.getElementById('globalBlockingEnabled') as HTMLInputElement).checked;
  const schedule = [
    {
      days: [0, 1, 2, 3, 4, 5, 6], // Optionally allow selecting specific days
      startTime: (document.getElementById('globalBlockingStart') as HTMLInputElement).value,
      endTime: (document.getElementById('globalBlockingEnd') as HTMLInputElement).value,
    },
  ];

  globalBlocking = { enabled, schedule };

  chrome.runtime.sendMessage(
    {
      action: 'updateSettings',
      settings: {
        globalBlocking: globalBlocking,
        domainSets: domainSets,
        lastSettingsUpdateDate: Date.now(),
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

// Function to save sync settings
function saveSyncSettings(): void {
  const syncEnabled = (document.getElementById('syncEnabled') as HTMLInputElement).checked;
  const syncCode = (document.getElementById('syncCode') as HTMLInputElement).value;
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

// Listen for messages from background.ts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'syncSettingsChanged') {
    loadSettings();
  }
});

// Function to load settings from background.ts
function loadSettings(): void {
  chrome.runtime.sendMessage({ action: 'getFullState' }, (response) => {
    const settings = response.settings || {};
    domainSets = settings.domainSets || {};
    globalBlocking = settings.globalBlocking || { enabled: false, schedule: [] };
    const syncEnabled = document.getElementById('syncEnabled') as HTMLInputElement;
    syncEnabled.checked = response.syncEnabled;
    const syncCode = document.getElementById('syncCode') as HTMLInputElement;
    syncCode.value = response.syncCode || '';
    const showTimer = document.getElementById('showTimer') as HTMLInputElement;
    showTimer.checked = response.showTimer || false;

    renderGlobalBlocking();
    renderDomainSets();
  });
}

// Event listeners for UI interactions
document.getElementById('addDomainSet')!.addEventListener('click', addDomainSet);
document.getElementById('saveSync')!.addEventListener('click', saveSyncSettings);
document.getElementById('domainSets')!.addEventListener('change', saveDomainSets);
document.getElementById('saveGlobalBlocking')!.addEventListener('click', saveGlobalBlockingSettings);
document.getElementById('showTimer')!.addEventListener('change', (e) => {
  chrome.runtime.sendMessage(
    {
      action: 'updateShowTimer',
      showTimer: (e.target as HTMLInputElement).checked,
    },
    () => {
      loadSettings();
    }
  );
});

// Load settings when the popup is opened
loadSettings();
