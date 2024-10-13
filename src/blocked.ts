// blocked.ts

const urlParams = new URLSearchParams(window.location.search);
const domain = urlParams.get('domain') ?? '';
const timeLimit = urlParams.get('timeLimit') ?? '';
const timeSpent = urlParams.get('timeSpent') ?? '';
let attemptsLeft = 3;

document.getElementById('domain')!.textContent = domain;

const reason = urlParams.get('reason');

if (reason === 'global') {
  document.getElementById('blockMessage')!.textContent = 'All sites are currently blocked due to global blocking settings.';
} else {
  document.getElementById('blockMessage')!.textContent = `You've spent ${timeSpent} on ${domain}. To support your well-being, your daily screen time is set to ${timeLimit}.`;
}

document.getElementById('passcodeMessage')!.textContent = `Close the site to stay within your daily time, or enter passcode 1234 to return to ${domain}.`;

document.getElementById('passcodeForm')!.addEventListener('submit', (e) => {
  e.preventDefault();
  const passcode = (document.getElementById('passcode') as HTMLInputElement).value;
  if (passcode === '1234') {
    chrome.runtime.sendMessage({ action: 'extendTime', domain, minutes: 10 }, () => {
      window.history.back();
    });
  } else {
    attemptsLeft--;
    if (attemptsLeft > 0) {
      alert(`Incorrect passcode. ${attemptsLeft} attempts left.`);
    } else {
      alert('No more attempts left. Please try again later.');
      document.getElementById('passcodeForm')!.style.display = 'none';
    }
  }
});