// content_script.ts

import { formatTime } from "./utils";

let timerElement: HTMLDivElement | null = null;
let timerEndTime: number | null = null;
let timerRequestId: number | null = null;
let port: chrome.runtime.Port;
let showTimer = true;

function createTimerElement(): void {
  if (!timerElement || !document.body.contains(timerElement)) {
    timerElement = document.createElement('div');
    timerElement.style.position = 'fixed';
    timerElement.style.top = '10px';
    timerElement.style.left = '10px';
    timerElement.style.padding = '5px 10px';
    timerElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    timerElement.style.color = 'white';
    timerElement.style.borderRadius = '5px';
    timerElement.style.zIndex = '9999';
    timerElement.style.fontSize = '14px';
    timerElement.style.fontFamily = 'Arial, sans-serif';
    timerElement.style.display = 'none';
    document.body.appendChild(timerElement);
  }
}

function updateTimerDisplay(timeLeft: number | null): void {
  createTimerElement();
  if (!timerElement) return;

  if (timeLeft === null || !showTimer) {
    timerElement.style.display = 'none';
  } else {
    timerElement.textContent = formatTime(Math.max(0, timeLeft));
    timerElement.style.display = 'block';
  }
}

function startPreciseTimer(duration: number): void {
  if (timerRequestId) {
    cancelAnimationFrame(timerRequestId);
  }

  timerEndTime = performance.now() + duration * 1000;

  function updateTimer(): void {
    if (!timerEndTime) return;
    const now = performance.now();
    const timeLeft = (timerEndTime - now) / 1000;

    if (timeLeft > 0) {
      updateTimerDisplay(timeLeft);
      timerRequestId = requestAnimationFrame(updateTimer);
    } else {
      updateTimerDisplay(0);
      port.postMessage({ action: 'getTimeLeft' });
    }
  }

  updateTimer();
}

function initializePort(): void {
  port = chrome.runtime.connect({ name: 'timerPort' });

  port.onMessage.addListener((message) => {
    if (message.action === 'updateTimer') {
      if (message.timeLeft === null) {
        if (timerRequestId) {
          cancelAnimationFrame(timerRequestId);
          timerRequestId = null;
        }
        updateTimerDisplay(null);
      } else {
        startPreciseTimer(message.timeLeft);
      }
    } else if (message.action === 'updateShowTimer') {
      showTimer = message.showTimer;
      console.log('Show timer updated:', showTimer);
      updateTimerDisplay(timerEndTime ? (timerEndTime - performance.now()) / 1000 : null);
    }
  });

  port.onDisconnect.addListener(() => {
    console.log('Port disconnected. Attempting to reconnect...');
    setTimeout(initializePort, 1000); // Attempt to reconnect after 1 second
  });

  // Request initial time left and show timer setting
  port.postMessage({ action: 'getTimeLeft' });
  port.postMessage({ action: 'getShowTimer' });
}

// Initialize connection to background script
initializePort();

// Periodically check connection and re-initialize if necessary
setInterval(() => {
  if (!port) {
    console.log('Port disconnected. Re-initializing...');
    initializePort();
  }
}, 5000);

// Handle potential YouTube-specific issues
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    console.log('URL changed. Requesting updated time.');
    port.postMessage({ action: 'getTimeLeft' });
  }
}).observe(document, { subtree: true, childList: true });

// Ensure timer persists across potential page reloads or changes
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    console.log('Page became visible. Requesting updated time.');
    port.postMessage({ action: 'getTimeLeft' });
  }
});

// Auth page handling
(function () {
  window.addEventListener('message', (event) => {
    if (event.origin !== 'https://timelimit-extension.firebaseapp.com' && event.origin !== 'https://timelimit-extension.web.app') {
      return;
    }

    if (event.data && event.data.type === 'SYNC_CODE') {
      chrome.runtime.sendMessage({ action: 'syncCodeGenerated', syncCode: event.data.syncCode })
        .then(() => {
          console.log('Sync code sent to background');
        })
        .catch((error) => {
          console.error('Error sending sync code to background script:', error);
        });
    }
  }, false);
})();
