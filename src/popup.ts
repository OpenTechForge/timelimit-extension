import { formatTime } from './utils';

let domainSets: { [key: string]: any } = {};
let globalBlocking: { entries: any[] } = { entries: [] };

document.addEventListener('DOMContentLoaded', () => {
  // Elements for sync settings
  const openAuthPageBtn = document.getElementById('openAuthPage') as HTMLElement;
  const syncEnabledCheckbox = document.getElementById('syncEnabled') as HTMLInputElement;
  const syncCodeInput = document.getElementById('syncCodeInput') as HTMLInputElement;
  const saveSyncButton = document.getElementById('saveSyncButton') as HTMLElement;
  const syncDetails = document.getElementById('syncDetails') as HTMLElement;
  const copySyncCodeButton = document.getElementById('copySyncCodeButton') as HTMLElement;

  // Event listeners for sync actions
  openAuthPageBtn.addEventListener('click', () => {
    const authUrl = 'https://timelimit-extension.firebaseapp.com/auth.html';
    chrome.tabs.create({ url: authUrl });
  });

  copySyncCodeButton.addEventListener('click', () => {
    const syncCode = syncCodeInput.value;
    if (syncCode) {
      navigator.clipboard.writeText(syncCode).then(() => {
        alert('Sync Code copied to clipboard!');
      });
    }
  });

  syncEnabledCheckbox.addEventListener('change', () => {
    const isSyncEnabled = syncEnabledCheckbox.checked;
    syncDetails.style.display = isSyncEnabled ? 'block' : 'none';
  });

  saveSyncButton.addEventListener('click', () => {
    const syncEnabled = syncEnabledCheckbox.checked;
    const syncCode = syncCodeInput.value.trim();

    chrome.runtime.sendMessage(
      {
        action: 'updateSyncSettings',
        syncEnabled: syncEnabled,
        syncCode: syncCode,
      },
      (response) => {
        if (response.success) {
          console.log('Saved sync settings in popup!');
          loadSettings();
        } else {
          console.error('Failed to save sync settings:', response.error);
        }
      }
    );
  });

  // Event listeners for UI interactions
  document.getElementById('addDomainSet')!.addEventListener('click', addDomainSet);
  document.getElementById('addGlobalBlockingEntry')!.addEventListener('click', addGlobalBlockingEntry);
  document.getElementById('saveGlobalBlocking')?.addEventListener('click', saveGlobalBlockingSettings);
  document.getElementById('domainSets')!.addEventListener('change', saveDomainSets);
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
});

// Function to render domain sets
function renderDomainSets(): void {
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
  const container = document.getElementById('globalBlockingList') as HTMLElement;
  container.innerHTML = '';

  globalBlocking.entries.forEach((entry, index) => {
    const div = document.createElement('div');
    div.className = 'global-blocking-entry';
    div.dataset.index = index.toString();
    div.innerHTML = `
      <h4>Global Blocking Entry ${index + 1}</h4>
      <label>
        <input type="checkbox" ${entry.enabled ? 'checked' : ''} class="global-blocking-enabled">
        Enable Global Blocking
      </label>
      <div>
        <label>Start Time:</label>
        <input type="time" value="${entry.schedule[0].startTime}" class="global-blocking-start">
      </div>
      <div>
        <label>End Time:</label>
        <input type="time" value="${entry.schedule[0].endTime}" class="global-blocking-end">
      </div>
      <div>
        <label>Whitelist Domains (comma-separated):</label>
        <input type="text" value="${(entry.whitelist || []).join(',')}" class="global-blocking-whitelist">
      </div>
      <button class="delete-global-blocking">Delete Entry</button>
    `;
    div.querySelector('.delete-global-blocking')!.addEventListener('click', () => deleteGlobalBlockingEntry(index));
    container.appendChild(div);
  });
}

// Function to add a new global blocking entry
function addGlobalBlockingEntry(): void {
  const newEntry = {
    enabled: false,
    schedule: [{ days: [0, 1, 2, 3, 4, 5, 6], startTime: '', endTime: '' }],
    whitelist: [],
  };
  globalBlocking.entries.push(newEntry);
  renderGlobalBlocking();
}

// Function to delete a global blocking entry
function deleteGlobalBlockingEntry(index: number): void {
  globalBlocking.entries.splice(index, 1);
  renderGlobalBlocking();
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

// Function to save global blocking settings
function saveGlobalBlockingSettings(): void {
  const entries = Array.from(document.querySelectorAll('.global-blocking-entry')).map((div) => {
    return {
      enabled: (div.querySelector('.global-blocking-enabled') as HTMLInputElement).checked,
      schedule: [
        {
          days: [0, 1, 2, 3, 4, 5, 6],
          startTime: (div.querySelector('.global-blocking-start') as HTMLInputElement).value,
          endTime: (div.querySelector('.global-blocking-end') as HTMLInputElement).value,
        },
      ],
      whitelist: (div.querySelector('.global-blocking-whitelist') as HTMLInputElement)
        .value.split(',')
        .map((d) => d.trim())
        .filter((d) => d !== ''),
    };
  });

  globalBlocking.entries = entries;

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

// Function to load settings from background.ts
function loadSettings(): void {
  chrome.runtime.sendMessage({ action: 'getFullState' }, (response) => {
    const settings = response.settings || {};
    domainSets = settings.domainSets || {};
    globalBlocking = settings.globalBlocking || { entries: [] };

    const syncEnabledCheckbox = document.getElementById('syncEnabled') as HTMLInputElement;
    const syncCodeInput = document.getElementById('syncCodeInput') as HTMLInputElement;
    const syncDetails = document.getElementById('syncDetails') as HTMLElement;

    syncEnabledCheckbox.checked = response.syncEnabled || false;
    syncCodeInput.value = response.syncCode || '';
    syncDetails.style.display = syncEnabledCheckbox.checked ? 'block' : 'none';

    const showTimer = document.getElementById('showTimer') as HTMLInputElement;
    showTimer.checked = response.showTimer || false;

    renderGlobalBlocking();
    renderDomainSets();
  });
}