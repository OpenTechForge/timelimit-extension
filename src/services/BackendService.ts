// backendService.ts
import { FirebaseBackendService } from './firebaseBackendService';

export interface BackendService {
  initialize(): Promise<void>;
  loadSettings(syncCode: string): Promise<any>;
  uploadSettings(syncCode: string, settings: any): Promise<void>;
  subscribeToSettings(syncCode: string, onUpdate: (data: any) => void): UnsubscribeFunction;
  removeListeners(syncCode: string): void;
}

type UnsubscribeFunction = () => void;

// Define the default backend service.
// This makes it easy to switch the backend service in the future.
const backendService: BackendService = new FirebaseBackendService();

export default backendService;