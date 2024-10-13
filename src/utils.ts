// utils.ts

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

export function sanitizeDomainSet(set: any): any {
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

export function mergeUpdates(localState: any, remoteUpdate: any): any {
  const mergedState = { ...localState };

  if ((remoteUpdate.lastSettingsUpdateDate || 0) > (localState.lastSettingsUpdateDate || 0)) {
    Object.assign(mergedState, remoteUpdate);
  }

  const localDomainSets = localState.domainSets || {};
  const remoteDomainSets = remoteUpdate.domainSets || {};

  const domainSetsById: any = { ...localDomainSets };

  for (const id in remoteDomainSets) {
    if (remoteDomainSets.hasOwnProperty(id)) {
      const remoteSet = remoteDomainSets[id];
      const localSet = domainSetsById[id];

      if (localSet) {
        let mergedSet = { ...localSet, ...remoteSet };
        mergedSet = sanitizeDomainSet(mergedSet);

        if ((remoteSet.lastResetDate || 0) > (localSet.lastResetDate || 0)) {
          mergedSet = { ...remoteSet };
        } else if ((localSet.lastResetDate || 0) > (remoteSet.lastResetDate || 0)) {
          mergedSet = { ...localSet };
        } else {
          mergedSet.timeSpent = Math.max(localSet.timeSpent || 0, remoteSet.timeSpent || 0);
          mergedSet.timeLeft = Math.min(localSet.timeLeft || Infinity, remoteSet.timeLeft || Infinity);
        }

        domainSetsById[id] = mergedSet;
      } else {
        domainSetsById[id] = sanitizeDomainSet(remoteSet);
      }
    }
  }

  mergedState.domainSets = domainSetsById;
  return mergedState;
}

import { AppState, DomainSet } from './types';

export function getLeastTimeLeft(state: AppState) {
  let leastTimeLeft: number = Infinity;
  let anyTimerExpired = false;
  let expiredSet: DomainSet | null = null;

  const domainSets = state.settings.domainSets;
  const activeTabDomain = state.activeTabDomain;

  Object.values(domainSets).forEach((set) => {
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
  });

  return {
    leastTimeLeft: leastTimeLeft === Infinity ? null : Math.max(0, leastTimeLeft),
    anyTimerExpired,
    expiredSet
  };
}
