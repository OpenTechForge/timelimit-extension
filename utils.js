// utils.js

function generateRandomCode(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function matchDomain(domain, pattern, strictMode) {
  if (!domain) return false;

  if (strictMode) {
    return domain === pattern;
  } else {
    domain = domain.replace(/^(www\.|m\.)/, '');
    pattern = pattern.replace(/^(www\.|m\.)/, '');
    return domain === pattern || domain.endsWith('.' + pattern);
  }
}

function sanitizeDomainSet(set) {
  return {
    domains: Array.isArray(set.domains) ? set.domains : [],
    timeSpent: typeof set.timeSpent === 'number' ? set.timeSpent : 0,
    timeLeft: typeof set.timeLeft === 'number' ? set.timeLeft : (typeof set.timeLimit === 'number' ? set.timeLimit : 0),
    timeLimit: typeof set.timeLimit === 'number' ? set.timeLimit : 0,
    strictMode: typeof set.strictMode === 'boolean' ? set.strictMode : false,
    lastResetDate: typeof set.lastResetDate === 'number' ? set.lastResetDate : Date.now(),
    lastSessionStart: typeof set.lastSessionStart === 'number' ? set.lastSessionStart : 0,
    lastSessionEnd: typeof set.lastSessionEnd === 'number' ? set.lastSessionEnd : 0,
    lastSessionActive: typeof set.lastSessionActive === 'boolean' ? set.lastSessionActive : false,
  };
}

function mergeUpdates(localState, remoteUpdate) {
  var mergedState = { ...localState };

  // Decide which settings to keep based on lastSettingsUpdateDate
  if ((remoteUpdate.lastSettingsUpdateDate || 0) > (localState.lastSettingsUpdateDate || 0)) {
    // Remote settings are more recent; merge them into mergedState
    mergedState = { ...mergedState, ...remoteUpdate };
  }

  // Ensure domainSets are objects
  const localDomainSets = localState.domainSets || {};
  const remoteDomainSets = remoteUpdate.domainSets || {};

  const domainSetsById = { ...localDomainSets };

  // Merge remote domain sets into the map
  for (const id in remoteDomainSets) {
    if (remoteDomainSets.hasOwnProperty(id)) {
      const remoteSet = remoteDomainSets[id];
      const localSet = domainSetsById[id];

      if (localSet) {
        // Both local and remote sets exist; merge them
        let mergedSet = { ...localSet, ...remoteSet };

        // Sanitize merged set
        mergedSet = sanitizeDomainSet(mergedSet);

        // Decide which times to keep based on lastResetDate
        if ((remoteSet.lastResetDate || 0) > (localSet.lastResetDate || 0)) {
          // Remote reset is more recent
          mergedSet.timeSpent = remoteSet.timeSpent;
          mergedSet.timeLeft = remoteSet.timeLeft;
          mergedSet.lastResetDate = remoteSet.lastResetDate;
          mergedSet.lastSessionStart = remoteSet.lastSessionStart;
          mergedSet.lastSessionEnd = remoteSet.lastSessionEnd;
          mergedSet.lastSessionActive = remoteSet.lastSessionActive;
        } else if ((localSet.lastResetDate || 0) > (remoteSet.lastResetDate || 0)) {
          // Local reset is more recent
          mergedSet.timeSpent = localSet.timeSpent;
          mergedSet.timeLeft = localSet.timeLeft;
          mergedSet.lastResetDate = localSet.lastResetDate;
          mergedSet.lastSessionStart = localSet.lastSessionStart;
          mergedSet.lastSessionEnd = localSet.lastSessionEnd;
          mergedSet.lastSessionActive = localSet.lastSessionActive;
        } else {
          // Resets occurred at the same time; merge conservatively
          mergedSet.timeSpent = Math.max(localSet.timeSpent || 0, remoteSet.timeSpent || 0);
          mergedSet.timeLeft = Math.min(localSet.timeLeft || Infinity, remoteSet.timeLeft || Infinity);
          mergedSet.lastSessionStart = Math.max(localSet.lastSessionStart || 0, remoteSet.lastSessionStart || 0);
          mergedSet.lastSessionEnd = Math.max(localSet.lastSessionEnd || 0, remoteSet.lastSessionEnd || 0);
          mergedSet.lastSessionActive = localSet.lastSessionActive || remoteSet.lastSessionActive;
        }

        domainSetsById[id] = mergedSet;
      } else {
        // Only remote set exists; add it to the map
        domainSetsById[id] = sanitizeDomainSet(remoteSet);
      }
    }
  }

  mergedState.domainSets = domainSetsById;

  return mergedState;
}
