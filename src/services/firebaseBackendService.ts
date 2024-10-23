// src/services/firebaseBackendService.ts
import { BackendService } from './BackendService';
import { getDatabase, ref, get, update, onValue, off } from 'firebase/database';
import { initializeDatabase } from './firebaseConfig';

export class FirebaseBackendService implements BackendService {
  async initialize(): Promise<void> {
    try {
      // Call initializeDatabase and wait for it to complete
      await initializeDatabase();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Error initializing the backend:', error);
      throw error; // Optionally, re-throw the error to be handled by the caller
    }
  }

  async uploadSettings(syncCode: string, data: any): Promise<void> {
    const db = getDatabase();
    const refSettings = ref(db, 'syncCodes/' + syncCode + '/settings');
    return update(refSettings, data);
  }

  async loadSettings(syncCode: string): Promise<any> {
    const db = getDatabase();
    const refSettings = ref(db, 'syncCodes/' + syncCode + '/settings');
    const snapshot = await get(refSettings);
    return snapshot.val();
  }

  subscribeToSettings(syncCode: string, onUpdate: (data: any) => void): () => void {
    const db = getDatabase();
    const refSettings = ref(db, 'syncCodes/' + syncCode + '/settings');

    const unsubscribe = onValue(refSettings, (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.val());
      }
    });

    // Return function to call `off()` to stop listening
    return () => off(refSettings);
  }

  removeListeners(syncCode: string): void {
    const db = getDatabase();
    const refSettings = ref(db, 'syncCodes/' + syncCode + '/settings');
    off(refSettings);
  }
}