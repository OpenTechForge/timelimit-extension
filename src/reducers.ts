// reducers.ts

import { Settings, DomainSet, GlobalBlocking, GlobalBlockingEntry, AppState } from './types'; // Assuming types are defined
import { cloneDeep } from 'lodash';

// Initial state
const initialState: AppState = {
  settings: {
    domainSets: {},
    globalBlocking: [],  // Update to support multiple blocking entries
    lastSettingsUpdateDate: Date.now()
  },
  syncEnabled: false,
  syncCode: '',
  syncInitialized: false,
  activeTabId: undefined,
  activeTabDomain: undefined,
  lastUpdateTime: Date.now(),
  isUpdatingTimers: false,
  showTimer: true,
  globalBlockingOverrideUntil: undefined,
  lastSettingsUpdateDate: Date.now(),
};

// Reducer
export function rootReducer(state = initialState, action: any): AppState {
  switch (action.type) {
    case 'SET_DOMAIN_SETS':
      return {
        ...state,
        settings: {
          ...state.settings,
          domainSets: cloneDeep(action.payload),
        },
      };

    case 'UPDATE_DOMAIN_SETS':
      return {
        ...state,
        settings: {
          ...state.settings,
          domainSets: {
            ...cloneDeep(state.settings.domainSets),
            ...cloneDeep(action.payload),
          },
        },
      };

    case 'SET_GLOBAL_BLOCKING':
      return {
        ...state,
        settings: {
          ...state.settings,
          globalBlocking: cloneDeep(action.payload), // Update to handle multiple global blocking entries
        },
      };

    case 'SET_SYNC_ENABLED':
      return { ...state, syncEnabled: action.payload };

    case 'SET_SYNC_CODE':
      return { ...state, syncCode: action.payload };

    case 'SET_SYNC_INITIALIZED':
      return { ...state, syncInitialized: action.payload };

    case 'SET_ACTIVE_TAB':
      return {
        ...state,
        activeTabId: action.payload.id,
        activeTabDomain: action.payload.domain,
      };

    case 'SET_LAST_UPDATE_TIME':
      return { ...state, lastUpdateTime: action.payload };

    case 'START_UPDATING_TIMERS':
      return { ...state, isUpdatingTimers: true };

    case 'FINISH_UPDATING_TIMERS':
      return { ...state, isUpdatingTimers: false };

    case 'SET_SHOW_TIMER':
      return { ...state, showTimer: action.payload };

    case 'SET_GLOBAL_BLOCKING_OVERRIDE':
      return { ...state, globalBlockingOverrideUntil: action.payload };

    case 'SET_SETTINGS':
      return {
        ...state,
        settings: cloneDeep(action.payload),
      };

    case 'SET_LAST_SETTINGS_UPDATE_DATE':
      return {
        ...state,
        settings: {
          ...cloneDeep(state.settings),
          lastSettingsUpdateDate: action.payload,
        },
      };

    default:
      return state;
  }
}