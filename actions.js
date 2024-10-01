// actions.js

// Action Types
var SET_SETTINGS = 'SET_SETTINGS';
var SET_DOMAIN_SETS = 'SET_DOMAIN_SETS';
var UPDATE_DOMAIN_SETS = 'UPDATE_DOMAIN_SETS';
var SET_GLOBAL_BLOCKING = 'SET_GLOBAL_BLOCKING';
var SET_SYNC_ENABLED = 'SET_SYNC_ENABLED';
var SET_SYNC_CODE = 'SET_SYNC_CODE';
var SET_SYNC_INITIALIZED = 'SET_SYNC_INITIALIZED';
var SET_ACTIVE_TAB = 'SET_ACTIVE_TAB';
var SET_LAST_UPDATE_TIME = 'SET_LAST_UPDATE_TIME';
var START_UPDATING_TIMERS = 'START_UPDATING_TIMERS';
var FINISH_UPDATING_TIMERS = 'FINISH_UPDATING_TIMERS';
var SET_SHOW_TIMER = 'SET_SHOW_TIMER';
var SET_GLOBAL_BLOCKING_OVERRIDE = 'SET_GLOBAL_BLOCKING_OVERRIDE';
var SET_LAST_SETTINGS_UPDATE_DATE = 'SET_LAST_SETTINGS_UPDATE_DATE';

// Action Creators
function setSettings(settings) {
  return { type: SET_SETTINGS, payload: settings };
}

function setDomainSets(domainSets) {
  return { type: SET_DOMAIN_SETS, payload: domainSets };
}

function updateDomainSets(updates) {
  return { type: UPDATE_DOMAIN_SETS, payload: updates };
}

function setGlobalBlocking(globalBlocking) {
  return { type: SET_GLOBAL_BLOCKING, payload: globalBlocking };
}

function setSyncEnabled(enabled) {
  return { type: SET_SYNC_ENABLED, payload: enabled };
}

function setSyncCode(code) {
  return { type: SET_SYNC_CODE, payload: code };
}

function setSyncInitialized(initialized) {
  return { type: SET_SYNC_INITIALIZED, payload: initialized };
}

function setActiveTab(id, domain) {
  return { type: SET_ACTIVE_TAB, payload: { id: id, domain: domain } };
}

function setLastUpdateTime(time) {
  return { type: SET_LAST_UPDATE_TIME, payload: time };
}

function startUpdatingTimers() {
  return { type: START_UPDATING_TIMERS };
}

function finishUpdatingTimers() {
  return { type: FINISH_UPDATING_TIMERS };
}

function setShowTimer(show) {
  return { type: SET_SHOW_TIMER, payload: show };
}

function setGlobalBlockingOverride(until) {
  return { type: SET_GLOBAL_BLOCKING_OVERRIDE, payload: until };
}

function setLastSettingsUpdateDate(date) {
  return { type: SET_LAST_SETTINGS_UPDATE_DATE, payload: date };
}

// Thunks
function loadSettings() {
  return function (dispatch) {
    console.log('Loading settings...');
    return new Promise(function (resolve) {
      chrome.storage.sync.get(
        ['settings', 'syncEnabled', 'syncCode', 'showTimer', 'globalBlockingOverrideUntil'],
        function (result) {
          console.log('Loaded settings:', result);

          const settings = result.settings || {
            domainSets: {},
            globalBlocking: {
              enabled: false,
              schedule: [],
            },
            lastSettingsUpdateDate: Date.now(),
            lastUpdateTime: Date.now()
          };

          const domainSets = {};
          const rawDomainSets = settings.domainSets || {};
          for (const id in rawDomainSets) {
            if (rawDomainSets.hasOwnProperty(id)) {
              const setData = rawDomainSets[id];
              domainSets[id] = sanitizeDomainSet({
                id: id,
                ...setData,
              });
            }
          }

          settings.domainSets = domainSets;
          settings.lastUpdateTime = settings.lastUpdateTime || Date.now();

          dispatch(setSettings(settings));
          dispatch(setSyncEnabled(result.syncEnabled || false));
          dispatch(setSyncCode(result.syncCode || ''));
          dispatch(setShowTimer(result.showTimer !== undefined ? result.showTimer : true));
          dispatch(setGlobalBlockingOverride(result.globalBlockingOverrideUntil || null));

          console.log('Processed settings:', settings);

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

function initializeFirebaseSync() {
  return function (dispatch, getState) {
    dispatch(setSyncInitialized(false));
    console.log('Initializing Firebase sync');

    const state = getState();
    const syncCode = state.syncCode;
    if (!syncCode) {
      console.error('No sync code available for synchronization');
      return Promise.reject('No sync code available');
    }

    const ref = database.ref('syncCodes/' + syncCode + '/settings');

    return ref
      .once('value')
      .then((snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          dispatch(handleIncomingUpdate(data));
        } else {
          console.log('No existing data in Firebase, uploading current settings');
          dispatch(uploadCurrentSettingsToFirebase());
        }

        // Set up a listener for future updates
        ref.on('value', (snapshot) => {
          const data = snapshot.val();
          if (data) {
            dispatch(handleIncomingUpdate(data));
          }
        });

        dispatch(setSyncInitialized(true));
        chrome.runtime.sendMessage({ action: 'syncSettingsChanged' });
      })
      .catch((error) => {
        console.error('Error initializing Firebase sync:', error);
        dispatch(setSyncInitialized(false));
      });
  };
}

function uploadCurrentSettingsToFirebase() {
  return function (dispatch, getState) {
    const state = getState();
    const updates = {
      settings: {
        domainSets: {},
        globalBlocking: state.settings.globalBlocking,
        lastUpdateTime: firebase.database.ServerValue.TIMESTAMP,
        lastSettingsUpdateDate: state.settings.lastSettingsUpdateDate,
      },
    };

    const domainSets = state.settings.domainSets;
    for (const setId in domainSets) {
      if (domainSets.hasOwnProperty(setId)) {
        const set = domainSets[setId];
        updates.settings.domainSets[setId] = sanitizeDomainSet(set);
      }
    }

    const syncCode = state.syncCode;
    const ref = database.ref('syncCodes/' + syncCode + '/settings');
    console.log("Going to update", updates.settings);

    return ref
      .update(updates.settings)
      .then(() => {
        console.log('Successfully uploaded settings to Firebase');
      })
      .catch((error) => {
        console.error('Firebase update failed:', error);
      });
  };
}

function handleIncomingUpdate(data) {
  return function (dispatch, getState) {
    const localState = getState();
    const mergedState = mergeUpdates(localState.settings, data);
    dispatch(processUpdate(mergedState));
  };
}

function processUpdate(mergedSettings) {
  return function (dispatch) {
    dispatch(setSettings(mergedSettings));
    dispatch(updateStorage(false)).then(function () {
      dispatch(updateActiveTabTimer());
    });
  };
}

function updateStorage(updateFirebase = true) {
  return function (dispatch, getState) {
    return new Promise(function (resolve) {
      const state = getState();
      const domainSetsObject = {};

      const domainSets = state.settings.domainSets;
      for (const setId in domainSets) {
        if (domainSets.hasOwnProperty(setId)) {
          const set = domainSets[setId];
          domainSetsObject[setId] = sanitizeDomainSet(set);
        }
      }

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

function updateTimers() {
  return function (dispatch, getState) {
    const state = getState();
    if (state.isUpdatingTimers) return Promise.resolve();

    dispatch(startUpdatingTimers());

    const now = Date.now();
    const secondsPassedSinceUpdate = (now - state.lastUpdateTime) / 1000;
    const updates = {};

    // Iterate over domainSets object
    const domainSets = state.settings.domainSets;
    Object.values(domainSets).forEach(function (set) {
      if (
        set.domains.some(function (d) {
          return matchDomain(state.activeTabDomain, d, set.strictMode);
        })
      ) {
        const secondsPassed = set.lastSessionActive
          ? (now - set.lastSessionEnd) / 1000
          : secondsPassedSinceUpdate;
        const newTimeSpent = set.timeSpent + secondsPassed;
        const newTimeLeft = Math.max(0, (set.timeLeft || 0) - secondsPassed);

        updates[set.id] = {
          ...set,
          timeSpent: newTimeSpent,
          timeLeft: newTimeLeft,
          lastSessionActive: true,
          lastSessionStart: set.lastSessionActive ? set.lastSessionStart : state.lastUpdateTime,
          lastSessionEnd: now,
        };
      } else if (set.lastSessionActive) {
        updates[set.id] = {
          ...set,
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

      // Update lastUpdateTime here
      dispatch(setLastUpdateTime(now));
      return dispatch(updateStorage(true)).then(function () {
        dispatch(finishUpdatingTimers());
        dispatch(notifyTimerUpdates());
      });
    } else {
      // Update lastUpdateTime even if no updates
      dispatch(setLastUpdateTime(now));
      dispatch(finishUpdatingTimers());
      dispatch(notifyTimerUpdates());
      return Promise.resolve();
    }
  };
}

function syncToFirebase() {
  return function (dispatch, getState) {
    const state = getState();
    if (!state.syncEnabled || !state.syncInitialized || !state.syncCode) {
      return Promise.resolve();
    }

    const ref = database.ref('syncCodes/' + state.syncCode + '/settings');

    return ref
      .transaction(function (currentData) {
        if (currentData == null) {
          // No data exists, write the current state
          return {
            domainSets: Object.keys(state.settings.domainSets).reduce((acc, setId) => {
              const set = state.settings.domainSets[setId];
              acc[setId] = sanitizeDomainSet(set);
              return acc;
            }, {}),
            globalBlocking: state.settings.globalBlocking,
            lastUpdateTime: firebase.database.ServerValue.TIMESTAMP,
            lastSettingsUpdateDate: state.settings.lastSettingsUpdateDate || Date.now(),
          };
        } else {
          // Merge local updates with current data
          const mergedData = mergeUpdates(currentData, {
            domainSets: Object.keys(state.settings.domainSets).reduce((acc, setId) => {
              const set = state.settings.domainSets[setId];
              acc[setId] = sanitizeDomainSet(set);
              return acc;
            }, {}),
            globalBlocking: state.settings.globalBlocking,
            lastUpdateTime: Date.now(),
            lastSettingsUpdateDate: state.settings.lastSettingsUpdateDate || Date.now(),
          });
          mergedData.lastUpdateTime = firebase.database.ServerValue.TIMESTAMP;
          return mergedData;
        }
      })
      .then(function () {
        console.log('Firebase transaction completed successfully');
      })
      .catch(function (error) {
        console.error('Firebase transaction failed:', error);
      });
  };
}

function getLeastTimeLeft() {
  const state = store.getState();
  let leastTimeLeft = Infinity;
  let anyTimerExpired = false;
  let expiredSet = null;

  const domainSets = state.settings.domainSets;
  Object.values(domainSets).forEach((set) => {
    if (
      set &&
      set.domains &&
      Array.isArray(set.domains) &&
      set.domains.some((d) => matchDomain(state.activeTabDomain, d, set.strictMode))
    ) {
      if (typeof set.timeLeft === 'number' && set.timeLeft < leastTimeLeft) {
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
    expiredSet,
  };
}

function onTimersUpdated() {
  return function (dispatch, getState) {
    const state = getState();
    const { leastTimeLeft, anyTimerExpired, expiredSet } = getLeastTimeLeft();

    if (anyTimerExpired) {
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

function notifyTimerUpdates() {
  return function (dispatch) {
    dispatch(onTimersUpdated());
  };
}

function updateActiveTabTimer() {
  return function (dispatch, getState) {
    const state = getState();
    if (state.activeTabId && state.activeTabDomain) {
      if (isGlobalBlockingActive(state) && state.activeTabDomain.indexOf('.') !== -1) {
        chrome.tabs.update(state.activeTabId, {
          url: 'blocked.html?reason=global&domain=' + state.activeTabDomain,
        });
        return;
      }
      dispatch(updateTimers());
    }
  };
}

function isGlobalBlockingActive(state) {
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
    if (schedule.days.indexOf(currentDay) !== -1) {
      const startTime = schedule.startTime.split(':').map(Number);
      const endTime = schedule.endTime.split(':').map(Number);
      const startTimeMinutes = startTime[0] * 60 + startTime[1];
      const endTimeMinutes = endTime[0] * 60 + endTime[1];

      if (startTimeMinutes > endTimeMinutes) {
        return currentTime >= startTimeMinutes || currentTime < endTimeMinutes;
      }
      return currentTime >= startTimeMinutes && currentTime < endTimeMinutes;
    }
    return false;
  });
}

function resetTimer(setId) {
  return function (dispatch, getState) {
    console.log('Resetting timer for set:', setId);
    const domainSets = getState().settings.domainSets;
    const set = domainSets[setId];
    if (set) {
      const now = Date.now();
      const updates = {
        [setId]: {
          ...set,
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
      return dispatch(updateStorage(true)).then(function () {
        dispatch(updateActiveTabTimer());
        console.log('Reset timer: Timer reset successfully');
      });
    } else {
      console.error('Domain set not found for reset:', setId);
      return Promise.reject('Domain set not found');
    }
  };
}

function deleteDomainSet(setId) {
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
    return dispatch(updateStorage(true)).then(function () {
      dispatch(updateActiveTabTimer());
      console.log('Domain set deleted successfully');
    });
  };
}

function addDomainSet(newSet) {
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
      return dispatch(updateStorage(true)).then(function () {
        dispatch(updateActiveTabTimer());
        console.log('New domain set added successfully');
      });
    } else {
      console.error('Invalid domain set:', newSet);
      return Promise.reject('Invalid domain set');
    }
  };
}

function extendTime(activeTabDomain, minutes) {
  return function (dispatch, getState) {
    console.log('Extending time by', minutes, 'minutes for', activeTabDomain);

    return new Promise(function (resolve, reject) {
      try {
        const overrideUntil = Date.now() + minutes * 60 * 1000;
        dispatch(setGlobalBlockingOverride(overrideUntil));
        console.log('Global blocking overridden until:', new Date(overrideUntil));

        const domainSets = getState().settings.domainSets;
        const updates = {};
        Object.entries(domainSets).forEach(([id, set]) => {
          if (
            set.domains.some(function (d) {
              return matchDomain(activeTabDomain, d, set.strictMode);
            })
          ) {
            updates[id] = { ...set, timeLeft: set.timeLeft + minutes * 60 };
          }
        });

        if (Object.keys(updates).length > 0) {
          const updatedDomainSets = { ...domainSets, ...updates };
          const newSettings = {
            ...getState().settings,
            domainSets: updatedDomainSets,
          };
          dispatch(setSettings(newSettings));
        }

        dispatch(updateStorage(true))
          .then(function () {
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

function applySyncSettingsUpdate(newSyncEnabled, newSyncCode) {
  return function (dispatch, getState) {
    console.log('Applying sync settings update:', newSyncEnabled, newSyncCode);
    const state = getState();
    const oldSyncEnabled = state.syncEnabled;
    const oldSyncCode = state.syncCode;

    dispatch(setSyncInitialized(false));
    dispatch(setSyncEnabled(newSyncEnabled));
    dispatch(setSyncCode(newSyncCode));

    return dispatch(updateStorage()).then(function () {
      console.log('Storage updated after sync settings change');
      if (!oldSyncEnabled && newSyncEnabled) {
        console.log('Sync was turned on');
        dispatch(initializeFirebaseSync());
      } else if (oldSyncEnabled && !newSyncEnabled) {
        console.log('Sync was turned off');
        database.ref('syncCodes/' + oldSyncCode + '/settings').off();
        console.log('Removed Firebase listeners');
      } else if (newSyncEnabled && oldSyncCode !== newSyncCode) {
        console.log('Sync code was changed');
        database.ref('syncCodes/' + oldSyncCode + '/settings').off();
        console.log('Removed old Firebase listeners');
        dispatch(initializeFirebaseSync());
      }

      dispatch(updateActiveTabTimer());
    });
  };
}
