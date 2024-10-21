// src/actions.ts

import { ThunkAction } from 'redux-thunk';
import { AppState } from './types';
import { Action } from 'redux';
import {
  DomainSet,
  GlobalBlocking,
  Settings,
  SET_SETTINGS,
  SET_DOMAIN_SETS,
  UPDATE_DOMAIN_SETS,
  SET_GLOBAL_BLOCKING,
  SET_SYNC_ENABLED,
  SET_SYNC_CODE,
  SET_SYNC_INITIALIZED,
  SET_ACTIVE_TAB,
  SET_LAST_UPDATE_TIME,
  START_UPDATING_TIMERS,
  FINISH_UPDATING_TIMERS,
  SET_SHOW_TIMER,
  SET_GLOBAL_BLOCKING_OVERRIDE,
  SET_LAST_SETTINGS_UPDATE_DATE
} from './types';
import { getDatabase, ref, off, update, onValue, set, serverTimestamp, Unsubscribe } from 'firebase/database';
import { mergeUpdates, getLeastTimeLeft, matchDomain, formatTime } from './utils';
import { configureStore } from '@reduxjs/toolkit';
import { rootReducer } from './reducers';
import { ports } from './background';
import thunk from 'redux-thunk';
import { initializeDatabase } from './firebase-config';
import { cloneDeep } from 'lodash';

// Store setup
const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware(),
  devTools: process.env.NODE_ENV !== 'production',
});

export default store;

// Action Types
interface SetSettingsAction extends Action<typeof SET_SETTINGS> {
  payload: Settings;
}

interface SetDomainSetsAction extends Action<typeof SET_DOMAIN_SETS> {
  payload: { [key: string]: DomainSet };
}

interface UpdateDomainSetsAction extends Action<typeof UPDATE_DOMAIN_SETS> {
  payload: { [key: string]: DomainSet };
}

interface SetGlobalBlockingAction extends Action<typeof SET_GLOBAL_BLOCKING> {
  payload: GlobalBlocking;
}

interface SetSyncEnabledAction extends Action<typeof SET_SYNC_ENABLED> {
  payload: boolean;
}

interface SetSyncCodeAction extends Action<typeof SET_SYNC_CODE> {
  payload: string;
}

interface SetSyncInitializedAction extends Action<typeof SET_SYNC_INITIALIZED> {
  payload: boolean;
}

interface SetActiveTabAction extends Action<typeof SET_ACTIVE_TAB> {
  payload: { id: number; domain: string };
}

interface SetLastUpdateTimeAction extends Action<typeof SET_LAST_UPDATE_TIME> {
  payload: number;
}

interface StartUpdatingTimersAction extends Action<typeof START_UPDATING_TIMERS> {}

interface FinishUpdatingTimersAction extends Action<typeof FINISH_UPDATING_TIMERS> {}

interface SetShowTimerAction extends Action<typeof SET_SHOW_TIMER> {
  payload: boolean;
}

interface SetGlobalBlockingOverrideAction extends Action<typeof SET_GLOBAL_BLOCKING_OVERRIDE> {
  payload: number | null;
}

interface SetLastSettingsUpdateDateAction extends Action<typeof SET_LAST_SETTINGS_UPDATE_DATE> {
  payload: number;
}

// Action Creators
export function setSettings(settings: Settings): SetSettingsAction {
  return { type: SET_SETTINGS, payload: settings };
}

export function setDomainSets(domainSets: { [key: string]: DomainSet }): SetDomainSetsAction {
  return { type: SET_DOMAIN_SETS, payload: domainSets };
}

export function updateDomainSets(updates: { [key: string]: DomainSet }): UpdateDomainSetsAction {
  return { type: UPDATE_DOMAIN_SETS, payload: updates };
}

export function setGlobalBlocking(globalBlocking: GlobalBlocking): SetGlobalBlockingAction {
  return { type: SET_GLOBAL_BLOCKING, payload: globalBlocking };
}

export function setSyncEnabled(enabled: boolean): SetSyncEnabledAction {
  return { type: SET_SYNC_ENABLED, payload: enabled };
}

export function setSyncCode(code: string): SetSyncCodeAction {
  return { type: SET_SYNC_CODE, payload: code };
}

export function setSyncInitialized(initialized: boolean): SetSyncInitializedAction {
  return { type: SET_SYNC_INITIALIZED, payload: initialized };
}

export function setActiveTab(id: number, domain: string): SetActiveTabAction {
  return { type: SET_ACTIVE_TAB, payload: { id, domain } };
}

export function setLastUpdateTime(time: number): SetLastUpdateTimeAction {
  return { type: SET_LAST_UPDATE_TIME, payload: time };
}

export function startUpdatingTimers(): StartUpdatingTimersAction {
  return { type: START_UPDATING_TIMERS };
}

export function finishUpdatingTimers(): FinishUpdatingTimersAction {
  return { type: FINISH_UPDATING_TIMERS };
}

export function setShowTimer(show: boolean): SetShowTimerAction {
  return { type: SET_SHOW_TIMER, payload: show };
}

export function setGlobalBlockingOverride(until: number | null): SetGlobalBlockingOverrideAction {
  return { type: SET_GLOBAL_BLOCKING_OVERRIDE, payload: until };
}

export function setLastSettingsUpdateDate(date: number): SetLastSettingsUpdateDateAction {
  return { type: SET_LAST_SETTINGS_UPDATE_DATE, payload: date };
}

// Thunks
export function loadSettings(): ThunkAction<Promise<void>, AppState, unknown, Action<string>> {
  return function (dispatch) {
    console.log('Loading settings...');
    return new Promise<void>((resolve) => {
      chrome.storage.sync.get(
        ['settings', 'syncEnabled', 'syncCode', 'showTimer', 'globalBlockingOverrideUntil'],
        function (result) {
          console.log('Loaded settings:', result);
          const settings: Settings = result.settings || {
            domainSets: {},
            globalBlocking: {
              enabled: false,
              schedule: [],
            },
            lastSettingsUpdateDate: Date.now(),
            lastUpdateTime: Date.now(),
          };
          const domainSets: { [key: string]: DomainSet } = {};
          const rawDomainSets = settings.domainSets || {};
          for (const id in rawDomainSets) {
            if (rawDomainSets.hasOwnProperty(id)) {
              const setData = rawDomainSets[id];
              domainSets[id] = {
                ...setData,
                id: id
              }
            }
          }

          const updatedSettings = cloneDeep(settings);
          updatedSettings.domainSets = cloneDeep(domainSets);

          dispatch(setSettings(updatedSettings));
          dispatch(setSyncEnabled(result.syncEnabled || false));
          dispatch(setSyncCode(result.syncCode || ''));
          dispatch(setShowTimer(result.showTimer !== undefined ? result.showTimer : true));
          dispatch(setGlobalBlockingOverride(result.globalBlockingOverrideUntil || null));
          if (result.syncEnabled) {
            console.log('Sync is enabled, initializing Firebase sync');
            dispatch(initializeFirebaseSync());
          }
          resolve();
        }
      );
    });
  };
}

export function initializeFirebaseSync(): ThunkAction<Promise<void>, AppState, unknown, Action<string>> {
  return function (dispatch, getState): Promise<void> {
    dispatch(setSyncInitialized(false));
    console.log('Initializing Firebase sync');

    initializeDatabase();
    const state = getState();
    const syncCode = state.syncCode;

    if (!syncCode) {
      console.error('No sync code available for synchronization');
      return Promise.reject(new Error('No sync code available for synchronization'));
    }

    const db = getDatabase();
    const refSettings = ref(db, 'syncCodes/' + syncCode + '/settings');

    return new Promise<void>((resolve, reject) => {
      // First, handle the initial state by getting the current data once.
      onValue(
        refSettings,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            console.log('First initialization: overriding local settings with Firebase data');
            dispatch(processUpdate(data)); // Replace local settings entirely with Firebase data
            dispatch(updateStorage(false))
              .then(() => {
                resolve(); // Successfully initialized sync
              })
              .catch(reject);
          } else {
            console.log('No existing data in Firebase, uploading current settings');
            dispatch(uploadCurrentSettingsToFirebase())
              .then(() => {
                resolve(); // Successfully uploaded local settings
              })
              .catch(reject);
          }

          // After the initial handling, subscribe to ongoing updates.
          off(refSettings); // Unsubscribe from the initial snapshot listener.
          // Set up a new listener for future updates.
          onValue(
            refSettings,
            (snapshot) => {
              if (snapshot.exists()) {
                const data = snapshot.val();
                dispatch(handleIncomingUpdate(data)); // Use merge logic for subsequent updates.
              }
            },
            (error) => {
              console.error('Error during Firebase sync update:', error);
            }
          );

          console.log("done initializing");
          dispatch(setSyncInitialized(true));
          chrome.runtime.sendMessage({ action: 'syncSettingsChanged' });
        },
        (error) => {
          console.error('Error initializing Firebase sync:', error);
          reject(error); // Reject on error
        }
      );
    });
  };
}

export function uploadCurrentSettingsToFirebase(): ThunkAction<Promise<void>, AppState, unknown, Action<string>> {
  return function (dispatch, getState) {
    const state = getState();
    const updates = {
      settings: {
        domainSets: { ...state.settings.domainSets },
        globalBlocking: state.settings.globalBlocking,
        lastSettingsUpdateDate: state.settings.lastSettingsUpdateDate,
      },
    };

    const syncCode = state.syncCode;
    const db = getDatabase();
    const refSettings = ref(db, 'syncCodes/' + syncCode + '/settings');
    console.log('Going to update', updates.settings);

    return update(refSettings, updates.settings)
      .then(() => {
        console.log('Successfully uploaded settings to Firebase');
      })
      .catch((error) => {
        console.error('Firebase update failed:', error);
      });
  };
}

export function handleIncomingUpdate(data: any): ThunkAction<void, AppState, unknown, Action<string>> {
  return function (dispatch, getState) {
    const localState = getState();
    const mergedState = mergeUpdates(localState.settings, data);
    dispatch(processUpdate(mergedState));
  };
}

export function processUpdate(mergedSettings: Settings): ThunkAction<void, AppState, unknown, Action<string>> {
  return function (dispatch) {
    dispatch(setSettings(mergedSettings));
    dispatch(updateStorage(false)).then(function () {
      dispatch(updateActiveTabTimer());
    });
  };
}

export function updateStorage(updateFirebase = true): ThunkAction<Promise<void>, AppState, unknown, Action<string>> {
  return function (dispatch, getState) {
    return new Promise<void>((resolve) => {
      const state = getState();
      const domainSetsObject: { [key: string]: DomainSet } = { ...state.settings.domainSets };

      const dataToStore = {
        settings: {
          domainSets: domainSetsObject,
          globalBlocking: state.settings.globalBlocking,
          lastSettingsUpdateDate: state.settings.lastSettingsUpdateDate || Date.now(),
        },
        syncEnabled: state.syncEnabled,
        syncCode: state.syncCode,
        showTimer: state.showTimer,
        globalBlockingOverrideUntil: state.globalBlockingOverrideUntil || null,
      };
      console.log('Data to store in chrome.storage.sync:', dataToStore);

      chrome.storage.sync.set(dataToStore, function () {
        if (state.syncEnabled && state.syncInitialized && updateFirebase) {
          dispatch(setLastUpdateTime(Date.now()));
          dispatch(syncToFirebase()).then(resolve).catch(resolve);
        } else {
          resolve();
        }
      });
    });
  };
}

// src/actions.ts continued

export function updateTimers(): ThunkAction<Promise<void>, AppState, unknown, Action<string>> {
  return function (dispatch, getState) {
    const state = getState();
    if (state.isUpdatingTimers) return Promise.resolve();

    dispatch(startUpdatingTimers());

    const now = Date.now();
    const secondsPassedSinceUpdate = (now - state.lastUpdateTime) / 1000;
    const updates: { [key: string]: DomainSet } = {};

    const domainSets = state.settings.domainSets;
    Object.values(domainSets).forEach(function (set) {
      if (
        set.domains.some(function (d) {
          return matchDomain(state.activeTabDomain, d, set.strictMode);
        })
      ) {
        const secondsPassed = set.lastSessionActive && set.lastSessionEnd
          ? (now - set.lastSessionEnd) / 1000
          : secondsPassedSinceUpdate;
        const newTimeSpent = set.timeSpent + secondsPassed;
        const newTimeLeft = Math.max(0, (set.timeLeft || 0) - secondsPassed);

        updates[set.id] = {
          ...cloneDeep(set),
          timeSpent: newTimeSpent,
          timeLeft: newTimeLeft,
          lastSessionActive: true,
          lastSessionStart: set.lastSessionActive ? set.lastSessionStart : state.lastUpdateTime,
          lastSessionEnd: now,
        };
      } else if (set.lastSessionActive) {
        updates[set.id] = {
          ...cloneDeep(set),
          lastSessionEnd: now,
          lastSessionActive: false,
        };
      }
    });

    if (Object.keys(updates).length > 0) {
      const newDomainSets = {
        ...state.settings.domainSets,
        ...updates,
      };
      const newSettings = {
        ...state.settings,
        domainSets: newDomainSets,
      };

      dispatch(setSettings(newSettings));
      dispatch(setLastUpdateTime(now));
      return dispatch(updateStorage(true)).then(() => {
        dispatch(finishUpdatingTimers());
        dispatch(notifyTimerUpdates());
      });
    } else {
      dispatch(setLastUpdateTime(now));
      dispatch(finishUpdatingTimers());
      dispatch(notifyTimerUpdates());
      return Promise.resolve();
    }
  };
}

export function syncToFirebase(): ThunkAction<Promise<void>, AppState, unknown, Action<string>> {
  return function (dispatch, getState) {
    const state = getState();
    if (!state.syncEnabled || !state.syncInitialized || !state.syncCode) {
      return Promise.resolve();
    }

    const db = getDatabase();
    const refSettings = ref(db, 'syncCodes/' + state.syncCode + '/settings');

    return update(refSettings, {
      domainSets: { ...state.settings.domainSets },
      globalBlocking: state.settings.globalBlocking,
      lastSettingsUpdateDate: state.settings.lastSettingsUpdateDate || Date.now(),
    })
      .then(() => {
        console.log('Firebase transaction completed successfully');
      })
      .catch((error) => {
        console.error('Firebase transaction failed:', error);
      });
  };
}

export function notifyTimerUpdates(): ThunkAction<void, AppState, unknown, Action<string>> {
  return function (dispatch) {
    dispatch(onTimersUpdated());
  };
}

export function onTimersUpdated(): ThunkAction<void, AppState, unknown, Action<string>> {
  return function (dispatch, getState) {
    const state = getState();
    if(!state.activeTabId) return;
    const { leastTimeLeft, anyTimerExpired, expiredSet } = getLeastTimeLeft(state);

    if (anyTimerExpired && expiredSet) {
      console.log('Timer expired, redirecting to blocked page');
      const timeSpent = formatTime(expiredSet.timeSpent);
      const timeLimit = formatTime(expiredSet.timeLimit);

      chrome.tabs.update(state.activeTabId, {
        url: `blocked.html?domain=${state.activeTabDomain}&timeSpent=${timeSpent}&domainSet=${expiredSet.domains.join(
          ','
        )}&timeLimit=${timeLimit}`,
      });
    } else {
      const port = ports.get(state.activeTabId);
      if (port) {
        port.postMessage({ action: 'updateTimer', timeLeft: leastTimeLeft });
      }
    }
  };
}

export function updateActiveTabTimer(): ThunkAction<void, AppState, unknown, Action<string>> {
  return function (dispatch, getState) {
    const state = getState();
    if (state.activeTabId && state.activeTabDomain) {
      if (isGlobalBlockingActive(state) && state.activeTabDomain.indexOf('.') !== -1) {
        chrome.tabs.update(state.activeTabId, {
          url: `blocked.html?reason=global&domain=${state.activeTabDomain}`,
        });
        return;
      }
      dispatch(updateTimers());
    }
  };
}

// Utility function to check if global blocking is active
export function isGlobalBlockingActive(state: AppState): boolean {
  const globalBlocking = state.settings.globalBlocking;
  const globalBlockingOverrideUntil = state.globalBlockingOverrideUntil;

  if (!globalBlocking.enabled || globalBlocking.schedule.length === 0) {
    return false;
  }

  const now = Date.now();

  if (globalBlockingOverrideUntil && globalBlockingOverrideUntil > now) {
    return false;
  }

  const nowDate = new Date();
  const currentDay = nowDate.getDay();
  const currentTime = nowDate.getHours() * 60 + nowDate.getMinutes();

  return globalBlocking.schedule.some(function (schedule) {
    const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
    const [endHour, endMinute] = schedule.endTime.split(':').map(Number);
    const startTimeMinutes = startHour * 60 + startMinute;
    const endTimeMinutes = endHour * 60 + endMinute;

    if (schedule.days.indexOf(currentDay) !== -1) {
      if (startTimeMinutes > endTimeMinutes) {
        return currentTime >= startTimeMinutes || currentTime < endTimeMinutes;
      }
      return currentTime >= startTimeMinutes && currentTime < endTimeMinutes;
    }
    return false;
  });
}

export function resetTimer(setId: string): ThunkAction<Promise<void>, AppState, unknown, Action<string>> {
  return function (dispatch, getState) {
    console.log('Resetting timer for set:', setId);
    const domainSets = getState().settings.domainSets;
    const set = domainSets[setId];
    if (set) {
      const now = Date.now();
      const updates = {
        [setId]: {
          ...cloneDeep(set),
          timeLeft: typeof set.timeLimit === 'number' ? set.timeLimit : 3600,
          timeSpent: 0,
          lastSessionStart: now,
          lastSessionEnd: now,
          lastResetDate: now,
          lastSessionActive: false,
        },
      };
      const newDomainSets = {
        ...domainSets,
        ...updates,
      };
      const newSettings = {
        ...getState().settings,
        domainSets: newDomainSets,
      };
      dispatch(setSettings(newSettings));
      return dispatch(updateStorage(true)).then(() => {
        dispatch(updateActiveTabTimer());
        console.log('Reset timer: Timer reset successfully');
      });
    } else {
      console.error('Domain set not found for reset:', setId);
      return Promise.reject('Domain set not found');
    }
  };
}

export function deleteDomainSet(setId: string): ThunkAction<Promise<void>, AppState, unknown, Action<string>> {
  return function (dispatch, getState) {
    console.log('Deleting domain set:', setId);
    const domainSets = getState().settings.domainSets;
    const updatedDomainSets = { ...domainSets };
    delete updatedDomainSets[setId];
    const newSettings = {
      ...getState().settings,
      domainSets: updatedDomainSets,
      lastSettingsUpdateDate: Date.now(),
    };
    dispatch(setSettings(newSettings));
    return dispatch(updateStorage(true)).then(() => {
      dispatch(updateActiveTabTimer());
      console.log('Domain set deleted successfully');
    });
  };
}

export function addDomainSet(newSet: DomainSet): ThunkAction<Promise<void>, AppState, unknown, Action<string>> {
  return function (dispatch, getState) {
    console.log('Adding new domain set:', newSet);
    if (newSet && newSet.id && newSet.domains && Array.isArray(newSet.domains)) {
      const domainSets = getState().settings.domainSets;
      const updatedDomainSets = { ...domainSets, [newSet.id]: newSet };
      const newSettings = {
        ...getState().settings,
        domainSets: updatedDomainSets,
        lastSettingsUpdateDate: Date.now(),
      };
      dispatch(setSettings(newSettings));
      return dispatch(updateStorage(true)).then(() => {
        dispatch(updateActiveTabTimer());
        console.log('New domain set added successfully');
      });
    } else {
      console.error('Invalid domain set:', newSet);
      return Promise.reject('Invalid domain set');
    }
  };
}

export function extendTime(
  activeTabDomain: string,
  minutes: number
): ThunkAction<Promise<void>, AppState, unknown, Action<string>> {
  return function (dispatch, getState) {
    console.log('Extending time by', minutes, 'minutes for', activeTabDomain);

    return new Promise<void>((resolve, reject) => {
      try {
        const overrideUntil = Date.now() + minutes * 60 * 1000;
        dispatch(setGlobalBlockingOverride(overrideUntil));
        console.log('Global blocking overridden until:', new Date(overrideUntil));

        const domainSets = getState().settings.domainSets;
        const updates: { [key: string]: DomainSet } = {};
        Object.entries(domainSets).forEach(([id, set]) => {
          if (
            set.domains.some(function (d) {
              return matchDomain(activeTabDomain, d, set.strictMode);
            })
          ) {
            updates[id] = { ...set, timeLeft: set.timeLeft + minutes * 60, lastResetDate: Date.now() };
          }
        });

        if (Object.keys(updates).length > 0) {
          const updatedDomainSets = { ...domainSets, ...updates };
          const newSettings = {
            ...getState().settings,
            domainSets: updatedDomainSets,
          };
          console.log("pushing new settings", newSettings);
          dispatch(setSettings(newSettings));
        }

        dispatch(updateStorage(true))
          .then(() => {
            console.log('Time extension complete');
            resolve();
          })
          .catch(reject);
      } catch (error) {
        console.error('Error in extendTime:', error);
        reject(error);
      }
    });
  };
}

export function applySyncSettingsUpdate(
  newSyncEnabled: boolean,
  newSyncCode: string
): ThunkAction<Promise<void>, AppState, unknown, Action<string>> {
  return function (dispatch, getState) {
    console.log('Applying sync settings update:', newSyncEnabled, newSyncCode);
    const state = getState();
    const oldSyncEnabled = state.syncEnabled;
    const oldSyncCode = state.syncCode;

    dispatch(setSyncInitialized(false));
    dispatch(setSyncEnabled(newSyncEnabled));
    dispatch(setSyncCode(newSyncCode));

    return dispatch(updateStorage()).then(() => {
      console.log('Storage updated after sync settings change');
      
      let promiseChain: Promise<void> = Promise.resolve();
    
      if (!oldSyncEnabled && newSyncEnabled) {
        console.log('Sync was turned on');
        promiseChain = dispatch(initializeFirebaseSync());
      } else if (oldSyncEnabled && !newSyncEnabled) {
        console.log('Sync was turned off');
        const db = getDatabase();
        const refSettings = ref(db, 'syncCodes/' + oldSyncCode + '/settings');
        off(refSettings);
        console.log('Removed Firebase listeners');
      } else if (newSyncEnabled && oldSyncCode !== newSyncCode) {
        console.log('Sync code was changed');
        const db = getDatabase();
        const refSettings = ref(db, 'syncCodes/' + oldSyncCode + '/settings');
        off(refSettings);
        console.log('Removed old Firebase listeners');
        promiseChain = dispatch(initializeFirebaseSync());
      }
    
      return promiseChain.then(() => {
        dispatch(updateActiveTabTimer());
      });
    });    
  };
}
