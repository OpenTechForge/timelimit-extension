// Action Types
export const SET_SETTINGS = 'SET_SETTINGS';
export const SET_DOMAIN_SETS = 'SET_DOMAIN_SETS';
export const UPDATE_DOMAIN_SETS = 'UPDATE_DOMAIN_SETS';
export const SET_GLOBAL_BLOCKING = 'SET_GLOBAL_BLOCKING';
export const SET_SYNC_ENABLED = 'SET_SYNC_ENABLED';
export const SET_SYNC_CODE = 'SET_SYNC_CODE';
export const SET_SYNC_INITIALIZED = 'SET_SYNC_INITIALIZED';
export const SET_ACTIVE_TAB = 'SET_ACTIVE_TAB';
export const SET_LAST_UPDATE_TIME = 'SET_LAST_UPDATE_TIME';
export const START_UPDATING_TIMERS = 'START_UPDATING_TIMERS';
export const FINISH_UPDATING_TIMERS = 'FINISH_UPDATING_TIMERS';
export const SET_SHOW_TIMER = 'SET_SHOW_TIMER';
export const SET_GLOBAL_BLOCKING_OVERRIDE = 'SET_GLOBAL_BLOCKING_OVERRIDE';
export const SET_LAST_SETTINGS_UPDATE_DATE = 'SET_LAST_SETTINGS_UPDATE_DATE';

// Interfaces for various settings and state

export interface DomainSet {
  id: string;
  domains: string[];
  strictMode: boolean;
  timeLimit: number;   // Time limit in seconds
  timeLeft: number;    // Time left in seconds
  timeSpent: number;   // Time spent in seconds
  lastSessionStart?: number;
  lastSessionEnd?: number;
  lastSessionActive?: boolean;
  lastResetDate?: number;
}

export interface GlobalBlocking {
  enabled: boolean;
  schedule: Schedule[];
}

export interface Schedule {
  days: number[];  // Days of the week [0 = Sunday, 6 = Saturday]
  startTime: string;  // Start time in HH:MM
  endTime: string;    // End time in HH:MM
}

export interface Settings {
  domainSets: { [key: string]: DomainSet };
  globalBlocking: GlobalBlocking;
  lastSettingsUpdateDate: number;
}

// Redux State

export interface AppState {
  settings: Settings;
  syncEnabled: boolean;
  syncCode: string;
  syncInitialized: boolean;
  activeTabId?: number;
  activeTabDomain?: string;
  isUpdatingTimers: boolean;
  showTimer: boolean;
  globalBlockingOverrideUntil?: number;
  lastSettingsUpdateDate?: number;
  lastUpdateTime: number
}

// Action Interfaces

export interface SetSettingsAction {
  type: typeof SET_SETTINGS;
  payload: Settings;
}

export interface SetDomainSetsAction {
  type: typeof SET_DOMAIN_SETS;
  payload: { [key: string]: DomainSet };
}

export interface UpdateDomainSetsAction {
  type: typeof UPDATE_DOMAIN_SETS;
  payload: { [key: string]: Partial<DomainSet> };
}

export interface SetGlobalBlockingAction {
  type: typeof SET_GLOBAL_BLOCKING;
  payload: GlobalBlocking;
}

export interface SetSyncEnabledAction {
  type: typeof SET_SYNC_ENABLED;
  payload: boolean;
}

export interface SetSyncCodeAction {
  type: typeof SET_SYNC_CODE;
  payload: string;
}

export interface SetSyncInitializedAction {
  type: typeof SET_SYNC_INITIALIZED;
  payload: boolean;
}

export interface SetActiveTabAction {
  type: typeof SET_ACTIVE_TAB;
  payload: { id: number; domain: string };
}

export interface StartUpdatingTimersAction {
  type: typeof START_UPDATING_TIMERS;
}

export interface FinishUpdatingTimersAction {
  type: typeof FINISH_UPDATING_TIMERS;
}

export interface SetShowTimerAction {
  type: typeof SET_SHOW_TIMER;
  payload: boolean;
}

export interface SetGlobalBlockingOverrideAction {
  type: typeof SET_GLOBAL_BLOCKING_OVERRIDE;
  payload: number;
}

export interface SetLastSettingsUpdateDateAction {
  type: typeof SET_LAST_SETTINGS_UPDATE_DATE;
  payload: number;
}

// Union Type for Actions

export type AppActions =
  | SetSettingsAction
  | SetDomainSetsAction
  | UpdateDomainSetsAction
  | SetGlobalBlockingAction
  | SetSyncEnabledAction
  | SetSyncCodeAction
  | SetSyncInitializedAction
  | SetActiveTabAction
  | StartUpdatingTimersAction
  | FinishUpdatingTimersAction
  | SetShowTimerAction
  | SetGlobalBlockingOverrideAction
  | SetLastSettingsUpdateDateAction;
  
