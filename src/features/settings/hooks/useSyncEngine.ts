import { useState, useEffect } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DataDiff, SyncEngineState } from '../types';
import { Task } from '../../checklist/types';
import {
  readTasks,
  writeReconciliation,
  deserializeCsvToTasks,
  serializeTasksToCsv,
  setVerboseLogging,
  writeTraceLog,
  readTraceLogs,
  clearTraceLogs,
} from '../../../services/csvStorage';

const STORAGE_KEYS = {
  LAST_SYNC: '@sync_last_date',
  VERBOSE_LOGS: '@sync_verbose_logs',
};

export function useSyncEngine(onSyncComplete?: () => void) {
  const [state, setState] = useState<SyncEngineState>({
    isVerboseLogging: false,
    lastSyncDate: null,
    error: null,
    loading: false,
  });

  const [externalUri, setExternalUri] = useState<string | null>(null);
  const [externalTasks, setExternalTasks] = useState<Task[]>([]);
  const [diffs, setDiffs] = useState<DataDiff[]>([]);

  // Load configuration at startup
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const lastSync = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
        const verboseStr = await AsyncStorage.getItem(STORAGE_KEYS.VERBOSE_LOGS);
        const verbose = verboseStr === 'true';
        
        setVerboseLogging(verbose);
        setState(prev => ({
          ...prev,
          lastSyncDate: lastSync,
          isVerboseLogging: verbose,
        }));
      } catch (err) {
        console.error('Failed to load sync engine config:', err);
      }
    };
    loadConfig();
  }, []);

  const toggleVerboseLogging = async (active: boolean) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.VERBOSE_LOGS, active ? 'true' : 'false');
      setVerboseLogging(active);
      setState(prev => ({ ...prev, isVerboseLogging: active }));
      await writeTraceLog(`[CONFIG] Verbose logging set to ${active}`);
    } catch (err) {
      console.error('Failed to toggle logging:', err);
    }
  };

  /**
   * Prompts user for a CSV file and calculates diff relative to local tasks database.
   */
  const scanExternalFile = async (): Promise<DataDiff[] | null> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      // 1. Pick file
      const docResult = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values'],
        copyToCacheDirectory: true,
      });

      if (docResult.canceled || !docResult.assets || docResult.assets.length === 0) {
        setState(prev => ({ ...prev, loading: false }));
        return null;
      }

      const fileAsset = docResult.assets[0];
      setExternalUri(fileAsset.uri);
      await writeTraceLog(`[SCAN] Selected file: ${fileAsset.name} (URI: ${fileAsset.uri})`);

      // 2. Read and parse external file
      const externalCsv = await FileSystem.readAsStringAsync(fileAsset.uri);
      const extTaskList = deserializeCsvToTasks(externalCsv);
      setExternalTasks(extTaskList);
      
      // 3. Read sandbox database
      const localTaskList = await readTasks();

      // 4. Calculate Diffs
      const calculatedDiffs: DataDiff[] = [];
      const localMap = new Map(localTaskList.map(t => [t.uuid, t]));
      const externalMap = new Map(extTaskList.map(t => [t.uuid, t]));

      // Rule 1: Find tasks new or modified in mirror
      for (const extTask of extTaskList) {
        const localTask = localMap.get(extTask.uuid);
        if (!localTask) {
          calculatedDiffs.push({
            uuid: extTask.uuid,
            field: 'all',
            sandboxValue: '',
            mirrorValue: extTask.title,
            status: 'NEW_IN_MIRROR',
          });
          await writeTraceLog(`[SYNC_SCAN] Detected NEW task in mirror: ${extTask.title} (UUID: ${extTask.uuid})`);
        } else {
          const modifiedFields: string[] = [];
          if (localTask.title !== extTask.title) modifiedFields.push('title');
          if (localTask.type !== extTask.type) modifiedFields.push('type');
          if (localTask.completed !== extTask.completed) modifiedFields.push('completed');
          
          const alertsMatch = JSON.stringify([...localTask.alerts].sort()) === JSON.stringify([...extTask.alerts].sort());
          if (!alertsMatch) modifiedFields.push('alerts');

          if (modifiedFields.length > 0) {
            calculatedDiffs.push({
              uuid: extTask.uuid,
              field: modifiedFields.join(', '),
              sandboxValue: `${localTask.title} (${modifiedFields.map(f => `${f}: ${String((localTask as any)[f])}`).join(', ')})`,
              mirrorValue: `${extTask.title} (${modifiedFields.map(f => `${f}: ${String((extTask as any)[f])}`).join(', ')})`,
              status: 'MODIFIED_IN_MIRROR',
            });
            await writeTraceLog(`[SYNC_SCAN] Detected MODIFIED task in mirror: ${extTask.title} (UUID: ${extTask.uuid}) modified fields: ${modifiedFields.join(', ')}`);
          }
        }
      }

      // Rule 2: Find tasks deleted in mirror (exist in local sandbox but missing in mirror)
      for (const localTask of localTaskList) {
        if (!externalMap.has(localTask.uuid)) {
          calculatedDiffs.push({
            uuid: localTask.uuid,
            field: 'all',
            sandboxValue: localTask.title,
            mirrorValue: '',
            status: 'DELETED_IN_MIRROR',
          });
          await writeTraceLog(`[SYNC_SCAN] Detected DELETED task in mirror: ${localTask.title} (UUID: ${localTask.uuid})`);
        }
      }

      setDiffs(calculatedDiffs);
      return calculatedDiffs;

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown sync scanning failure';
      setState(prev => ({ ...prev, error: errMsg }));
      await writeTraceLog(`[ERROR] Scan failure: ${errMsg}`);
      return null;
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  /**
   * Sync Option 1: Accept Mirror Modifications. Overwrites local sandbox tasks.
   */
  const acceptMirrorModifications = async () => {
    if (!externalUri) return;
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      await writeTraceLog(`[SYNC] Accepting mirror modifications. Merging mirror tasks into sandbox.`);

      // Merge: Keep external tasks as source of truth
      const mergedTasks = [...externalTasks];

      // Execute transaction with rollback constraints
      await writeReconciliation(mergedTasks, null, null);

      const timestamp = new Date().toLocaleString();
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, timestamp);
      setState(prev => ({ ...prev, lastSyncDate: timestamp }));
      
      await writeTraceLog(`[SYNC] Local sandbox database updated successfully.`);
      setDiffs([]);
      
      if (onSyncComplete) onSyncComplete();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to reconcile sandbox';
      setState(prev => ({ ...prev, error: errMsg }));
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  /**
   * Sync Option 2: Reject / Preserve Local. Overwrites external mirror file with local state.
   */
  const rejectMirrorModifications = async () => {
    if (!externalUri) return;
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      await writeTraceLog(`[SYNC] Rejecting mirror modifications. Overwriting external file with local sandbox state.`);

      const localTasks = await readTasks();
      const localCsv = serializeTasksToCsv(localTasks);

      // Execute transaction with rollback constraints
      await writeReconciliation(localTasks, externalUri, localCsv);

      const timestamp = new Date().toLocaleString();
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, timestamp);
      setState(prev => ({ ...prev, lastSyncDate: timestamp }));

      await writeTraceLog(`[SYNC] External mirror target updated successfully.`);
      setDiffs([]);

      if (onSyncComplete) onSyncComplete();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to reconcile external mirror';
      setState(prev => ({ ...prev, error: errMsg }));
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  return {
    state,
    externalUri,
    diffs,
    toggleVerboseLogging,
    scanExternalFile,
    acceptMirrorModifications,
    rejectMirrorModifications,
    clearLogs: clearTraceLogs,
    readLogs: readTraceLogs,
  };
}
