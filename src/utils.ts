// utils.ts
import { AppState, DomainSet, Settings } from './types';
import { cloneDeep } from 'lodash';

export function generateRandomCode(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function matchDomain(domain: string | undefined | null, pattern: string, strictMode: boolean): boolean {
  if (!domain) return false;

  if (strictMode) {
    return domain === pattern;
  } else {
    domain = domain.replace(/^(www\.|m\.)/, '');
    pattern = pattern.replace(/^(www\.|m\.)/, '');
    return domain === pattern || domain.endsWith('.' + pattern);
  }
}

export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function sanitizeDomainSet(set: any): DomainSet {
  return {
    id: typeof set.id === 'string' ? set.id : set.id.toString(),
    domains: Array.isArray(set.domains) ? set.domains : [],
    strictMode: typeof set.strictMode === 'boolean' ? set.strictMode : false,
    timeLimit: typeof set.timeLimit === 'number' ? set.timeLimit : 0,
    timeLeft: typeof set.timeLeft === 'number' ? set.timeLeft : 0,
    timeSpent: typeof set.timeSpent === 'number' ? set.timeSpent : 0,
    lastSessionStart: typeof set.lastSessionStart === 'number' ? set.lastSessionStart : undefined,
    lastSessionEnd: typeof set.lastSessionEnd === 'number' ? set.lastSessionEnd : undefined,
    lastSessionActive: typeof set.lastSessionActive === 'boolean' ? set.lastSessionActive : false,
    lastResetDate: typeof set.lastResetDate === 'number' ? set.lastResetDate : undefined
  };
}

export function mergeUpdates(localState: Settings, remoteUpdate: any): Settings {
  // Create a deep copy of localState to avoid mutation
  const mergedState = { ...localState };

  // Merge settings if remote update is newer
  if ((remoteUpdate.lastSettingsUpdateDate || 0) > (localState.lastSettingsUpdateDate || 0)) {
    Object.assign(mergedState, remoteUpdate);
  }

  const localDomainSets = localState.domainSets || {};
  const remoteDomainSets = remoteUpdate.domainSets || {};

  // Create a new object to store merged domain sets
  const domainSetsById = cloneDeep(mergedState.domainSets);

  for (const id in remoteDomainSets) {
    if (remoteDomainSets.hasOwnProperty(id)) {
      const remoteSet = remoteDomainSets[id];
      const localSet = domainSetsById[id];

      if (localSet) {
        let mergedSet = { ...localSet, ...remoteSet };
        mergedSet = sanitizeDomainSet(mergedSet);

        if ((remoteSet.lastResetDate || 0) > (localSet.lastResetDate || 0)) {
          mergedSet = { ...sanitizeDomainSet(remoteSet) };
        } else if ((localSet.lastResetDate || 0) > (remoteSet.lastResetDate || 0)) {
          mergedSet = { ...localSet };
        } else {
          mergedSet.timeSpent = Math.max(localSet.timeSpent || 0, remoteSet.timeSpent || 0);
          mergedSet.timeLeft = Math.min(localSet.timeLeft || Infinity, remoteSet.timeLeft || Infinity);
          if (mergedSet.timeLeft === Infinity) {
            mergedSet.timeLeft = localSet.timeLeft;
          }
        }

        domainSetsById[id] = mergedSet;
      } else {
        domainSetsById[id] = sanitizeDomainSet(remoteSet);
      }
    }
  }

  // Ensure a new object is assigned to avoid mutating the original state
  mergedState.domainSets = { ...domainSetsById };

  return mergedState;
}

export function getLeastTimeLeft(state: AppState) {
  let leastTimeLeft: number = Infinity;
  let anyTimerExpired = false;
  let expiredSet: DomainSet | null = null;

  const domainSets = state.settings.domainSets;
  const activeTabDomain = state.activeTabDomain;

  for (const set of Object.values(domainSets)) {
    if (
     set.domains.some((d) => matchDomain(activeTabDomain, d, set.strictMode))
    ) {
      if (set.timeLeft < leastTimeLeft) {
        leastTimeLeft = set.timeLeft;
        if (set.timeLeft <= 0) {
          anyTimerExpired = true;
          expiredSet = set;
          console.log('Timer expired for set:', set);
        }
      }
    }
  }

  return {
    leastTimeLeft: leastTimeLeft === Infinity ? null : Math.max(0, leastTimeLeft),
    anyTimerExpired,
    expiredSet
  };
}
