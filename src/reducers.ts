// reducers.ts

import { Settings, DomainSet, GlobalBlocking } from './types'; // Assuming types are defined

// Define the shape of the initial state
interface RootState {
  settings: Settings;
  syncEnabled: boolean;
  syncCode: string;
  syncInitialized: boolean;
  activeTabId: number | null;
  activeTabDomain: string | null;
  lastUpdateTime: number;
  isUpdatingTimers: boolean;
  showTimer: boolean;
  globalBlockingOverrideUntil: number | null;
  lastSettingsUpdateDate: number;
}

// Initial state
const initialState: RootState = {
  settings: {
    domainSets: {},
    globalBlocking: {
      enabled: false,
      schedule: [],
    },
    lastSettingsUpdateDate: Date.now(),
    lastUpdateTime: Date.now(),
  },
  syncEnabled: false,
  syncCode: '',
  syncInitialized: false,
  activeTabId: null,
  activeTabDomain: null,
  lastUpdateTime: Date.now(),
  isUpdatingTimers: false,
  showTimer: true,
  globalBlockingOverrideUntil: null,
  lastSettingsUpdateDate: Date.now(),
};

// Reducer
export function rootReducer(state = initialState, action: any): RootState {
  switch (action.type) {
    case 'SET_DOMAIN_SETS':
      return {
        ...state,
        settings: {
          ...state.settings,
          domainSets: action.payload,
        },
      };

    case 'UPDATE_DOMAIN_SETS':
      return {
        ...state,
        settings: {
          ...state.settings,
          domainSets: {
            ...state.settings.domainSets,
            ...action.payload,
          },
        },
      };

    case 'SET_GLOBAL_BLOCKING':
      return {
        ...state,
        settings: {
          ...state.settings,
          globalBlocking: action.payload,
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
        settings: action.payload,
      };

    case 'SET_LAST_SETTINGS_UPDATE_DATE':
      return {
        ...state,
        settings: {
          ...state.settings,
          lastSettingsUpdateDate: action.payload,
        },
      };

    default:
      return state;
  }
}
