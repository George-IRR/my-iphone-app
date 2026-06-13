import * as FileSystem from 'expo-file-system/legacy';
import { File } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Task, CompletionLog, TaskType } from '../features/checklist/types';

export const PERMANENT_MIRROR_KEY = '@sync_permanent_mirror_uri';

const TASKS_FILE_URI = FileSystem.documentDirectory + 'tasks.csv';
const COMPLETIONS_FILE_URI = FileSystem.documentDirectory + 'completions.csv';
const LAST_ACTIVE_FILE_URI = FileSystem.documentDirectory + 'last_active.txt';
const TRACE_LOG_FILE_URI = FileSystem.documentDirectory + 'mirror_trace.log';

/**
 * Escapes a string value to be RFC 4180 CSV compliant.
 */
export function escapeCsvValue(val: string | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * RFC 4180 compliant CSV text parser.
 */
export function parseCsv(csvText: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;
  
  let i = 0;
  while (i < csvText.length) {
    const char = csvText[i];
    
    if (char === '"') {
      if (inQuotes && csvText[i + 1] === '"') {
        current += '"';
        i += 2;
      } else {
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      i++;
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      row.push(current);
      current = '';
      if (row.length > 0 && (row.length > 1 || row[0] !== '')) {
        result.push(row);
      }
      row = [];
      if (char === '\r' && csvText[i + 1] === '\n') {
        i += 2;
      } else {
        i++;
      }
    } else {
      current += char;
      i++;
    }
  }
  
  if (current !== '' || row.length > 0) {
    row.push(current);
    if (row.length > 0 && (row.length > 1 || row[0] !== '')) {
      result.push(row);
    }
  }
  
  return result;
}

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Generates a cryptographically random UUID v4 using native expo-crypto.
 */
export function generateUuid(): string {
  return Crypto.randomUUID();
}

/**
 * Serializes task items array into CSV string.
 */
export function serializeTasksToCsv(tasks: Task[]): string {
  const header = 'uuid,id,title,type,completed,completed_date,created_date,alerts,deleted';
  const lines = tasks.map(task => {
    const uuid = escapeCsvValue(task.uuid || generateUuid());
    const id = escapeCsvValue(task.id);
    const title = escapeCsvValue(task.title);
    const type = escapeCsvValue(task.type);
    const completed = escapeCsvValue(task.completed ? 'true' : 'false');
    const completedDate = escapeCsvValue(task.completed_date);
    const createdDate = escapeCsvValue(task.created_date);
    const alerts = escapeCsvValue(JSON.stringify(task.alerts));
    const deleted = escapeCsvValue(task.deleted ? 'true' : 'false');
    return `${uuid},${id},${title},${type},${completed},${completedDate},${createdDate},${alerts},${deleted}`;
  });
  return [header, ...lines].join('\n');
}

/**
 * Deserializes CSV string into task items with legacy shift logic.
 */
export function deserializeCsvToTasks(csvText: string): Task[] {
  const rows = parseCsv(csvText);
  if (rows.length <= 1) return [];
  
  const header = rows[0];
  const uuidIdx = header.indexOf('uuid');
  const idIdx = header.indexOf('id');
  const titleIdx = header.indexOf('title');
  const typeIdx = header.indexOf('type');
  const completedIdx = header.indexOf('completed');
  const completedDateIdx = header.indexOf('completed_date');
  const createdDateIdx = header.indexOf('created_date');
  const alertsIdx = header.indexOf('alerts');
  const deletedIdx = header.indexOf('deleted');
  
  const tasks: Task[] = [];
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0 || (row.length === 1 && row[0] === '')) continue;
    
    let uuidVal = '';
    let idVal = '';
    let titleVal = '';
    let typeVal: 'daily' | 'onetime' = 'daily';
    let completedVal = false;
    let completedDateVal: string | null = null;
    let createdDateVal = new Date().toISOString();
    let alertsVal: string[] = [];
    let deletedVal = false;

    const hasUuidHeader = uuidIdx !== -1;
    const firstElement = row[0] || '';
    const isFirstElementUuid = UUID_REGEX.test(firstElement);
    
    if (hasUuidHeader && isFirstElementUuid) {
      uuidVal = row[uuidIdx] || generateUuid();
      idVal = idIdx !== -1 ? row[idIdx] : uuidVal;
      titleVal = titleIdx !== -1 ? row[titleIdx] : '';
      typeVal = typeIdx !== -1 && row[typeIdx] === 'onetime' ? 'onetime' : 'daily';
      completedVal = completedIdx !== -1 && row[completedIdx] === 'true';
      completedDateVal = completedDateIdx !== -1 ? (row[completedDateIdx] || null) : null;
      createdDateVal = createdDateIdx !== -1 ? (row[createdDateIdx] || new Date().toISOString()) : new Date().toISOString();
      deletedVal = deletedIdx !== -1 && row[deletedIdx] === 'true';
      
      const alertsStr = alertsIdx !== -1 ? row[alertsIdx] : '';
      if (alertsStr) {
        try {
          const parsed = JSON.parse(alertsStr);
          if (Array.isArray(parsed)) alertsVal = parsed.map(String);
        } catch {
          alertsVal = [];
        }
      }
    } else {
      uuidVal = generateUuid();
      idVal = idIdx !== -1 ? (row[idIdx] || uuidVal) : (row[0] || uuidVal);
      titleVal = titleIdx !== -1 ? row[titleIdx] : (row[1] || '');
      typeVal = (typeIdx !== -1 ? row[typeIdx] : row[2]) === 'onetime' ? 'onetime' : 'daily';
      completedVal = (completedIdx !== -1 ? row[completedIdx] : row[3]) === 'true';
      completedDateVal = completedDateIdx !== -1 ? (row[completedDateIdx] || null) : (row[4] || null);
      createdDateVal = createdDateIdx !== -1 ? (row[createdDateIdx] || new Date().toISOString()) : (row[5] || new Date().toISOString());
      deletedVal = deletedIdx !== -1 && row[deletedIdx] === 'true';
      
      const alertsStr = alertsIdx !== -1 ? row[alertsIdx] : (row[6] || '');
      if (alertsStr) {
        try {
          const parsed = JSON.parse(alertsStr);
          if (Array.isArray(parsed)) alertsVal = parsed.map(String);
        } catch {
          alertsVal = [];
        }
      }
    }
    
    tasks.push({
      uuid: uuidVal,
      id: idVal,
      title: titleVal,
      type: typeVal,
      completed: completedVal,
      completed_date: completedDateVal,
      created_date: createdDateVal,
      alerts: alertsVal,
      deleted: deletedVal,
    });
  }
  
  return tasks;
}

/**
 * Serializes completion logs into CSV string.
 */
export function serializeCompletionsToCsv(logs: CompletionLog[]): string {
  const header = 'task_id,completed_date';
  const lines = logs.map(log => {
    return `${escapeCsvValue(log.taskId)},${escapeCsvValue(log.completedDate)}`;
  });
  return [header, ...lines].join('\n');
}

/**
 * Deserializes CSV string into completion logs.
 */
export function deserializeCsvToCompletions(csvText: string): CompletionLog[] {
  const rows = parseCsv(csvText);
  if (rows.length <= 1) return [];
  
  const header = rows[0];
  const taskIdIdx = header.indexOf('task_id');
  const dateIdx = header.indexOf('completed_date');
  
  if (taskIdIdx === -1 || dateIdx === -1) {
    console.error('Completions CSV Header layout is invalid:', header);
    return [];
  }
  
  const logs: CompletionLog[] = [];
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 2) continue;
    logs.push({
      taskId: row[taskIdIdx] || '',
      completedDate: row[dateIdx] || '',
    });
  }
  
  return logs;
}

// File System CRUD implementations using procedural FileSystem API

export async function readTasks(): Promise<Task[]> {
  try {
    const info = await FileSystem.getInfoAsync(TASKS_FILE_URI);
    if (!info.exists) {
      return [];
    }
    const csvContent = await FileSystem.readAsStringAsync(TASKS_FILE_URI);
    return deserializeCsvToTasks(csvContent);
  } catch (error) {
    console.error('Error reading tasks CSV:', error);
    return [];
  }
}

// Serialization queue to prevent concurrent resource contention on file I/O operations
let writeQueue = Promise.resolve();

async function enqueueWrite(op: () => Promise<void>): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    try {
      await op();
    } catch (err) {
      console.error('CSV File System Serialization Write Error:', err);
    }
  });
  return writeQueue;
}

export async function writeTasks(tasks: Task[]): Promise<void> {
  return enqueueWrite(async () => {
    try {
      const csvContent = serializeTasksToCsv(tasks);
      await FileSystem.writeAsStringAsync(TASKS_FILE_URI, csvContent);
      await writeToPermanentMirror(csvContent);
    } catch (error) {
      console.error('Error writing tasks CSV:', error);
    }
  });
}

export async function readCompletions(): Promise<CompletionLog[]> {
  try {
    const info = await FileSystem.getInfoAsync(COMPLETIONS_FILE_URI);
    if (!info.exists) {
      return [];
    }
    const csvContent = await FileSystem.readAsStringAsync(COMPLETIONS_FILE_URI);
    return deserializeCsvToCompletions(csvContent);
  } catch (error) {
    console.error('Error reading completions CSV:', error);
    return [];
  }
}

export async function writeCompletions(logs: CompletionLog[]): Promise<void> {
  return enqueueWrite(async () => {
    try {
      const csvContent = serializeCompletionsToCsv(logs);
      await FileSystem.writeAsStringAsync(COMPLETIONS_FILE_URI, csvContent);
    } catch (error) {
      console.error('Error writing completions CSV:', error);
    }
  });
}

export async function readLastActiveDate(): Promise<string | null> {
  try {
    const info = await FileSystem.getInfoAsync(LAST_ACTIVE_FILE_URI);
    if (!info.exists) return null;
    return await FileSystem.readAsStringAsync(LAST_ACTIVE_FILE_URI);
  } catch {
    return null;
  }
}

export async function writeLastActiveDate(dateStr: string): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(LAST_ACTIVE_FILE_URI, dateStr);
  } catch (error) {
    console.error('Error writing last active date:', error);
  }
}

let verboseLoggingActive = false;

export function setVerboseLogging(active: boolean) {
  verboseLoggingActive = active;
}

export async function readTraceLogs(): Promise<string> {
  try {
    const info = await FileSystem.getInfoAsync(TRACE_LOG_FILE_URI);
    if (!info.exists) return '';
    return await FileSystem.readAsStringAsync(TRACE_LOG_FILE_URI);
  } catch {
    return '';
  }
}

export async function clearTraceLogs(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(TRACE_LOG_FILE_URI);
    if (info.exists) {
      await FileSystem.deleteAsync(TRACE_LOG_FILE_URI, { idempotent: true });
    }
  } catch (err) {
    console.error('Failed to clear trace logs:', err);
  }
}

export async function writeTraceLog(message: string): Promise<void> {
  // If verbose logging is disabled, only write system diagnostics, backups, and errors
  const isSystemOrError = message.startsWith('[SYSTEM]') || message.startsWith('[ERROR]') || message.startsWith('[BACKUP]');
  if (!verboseLoggingActive && !isSystemOrError) {
    return;
  }
  try {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${message}\n`;
    
    const info = await FileSystem.getInfoAsync(TRACE_LOG_FILE_URI);
    if (info.exists) {
      const existing = await FileSystem.readAsStringAsync(TRACE_LOG_FILE_URI);
      await FileSystem.writeAsStringAsync(TRACE_LOG_FILE_URI, existing + line);
    } else {
      await FileSystem.writeAsStringAsync(TRACE_LOG_FILE_URI, line);
    }
  } catch (err) {
    console.error('Failed to write trace log:', err);
  }
}

/**
 * Verifies the size of mirror_trace.log. If it exceeds 2MB, slices the data payload,
 * drops the older 50% section, and writes the remaining log rows back.
 */
export async function enforceLogSizeLimit(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(TRACE_LOG_FILE_URI);
    if (info.exists && info.size && info.size > 2 * 1024 * 1024) { // 2MB
      const logContent = await FileSystem.readAsStringAsync(TRACE_LOG_FILE_URI);
      const halfIndex = Math.floor(logContent.length / 2);
      let cutIndex = logContent.indexOf('\n', halfIndex);
      if (cutIndex === -1) {
        cutIndex = halfIndex;
      } else {
        cutIndex += 1;
      }
      const prunedContent = logContent.substring(cutIndex);
      await FileSystem.writeAsStringAsync(TRACE_LOG_FILE_URI, prunedContent);
      console.log('mirror_trace.log size exceeded 2MB, pruned older 50%');
      await writeTraceLog('[SYSTEM] Log size exceeded 2MB. Pruned older 50% of trace lines.');
    }
  } catch (err) {
    console.error('Failed to enforce log size limit:', err);
  }
}

/**
 * Transactional parity sync constraint: Executes both local sandbox write and external
 * mirror file write inside a singular atomic queue transaction.
 * Rolls back changes on both files if either write targets fail.
 */
export async function writeReconciliation(
  localTasks: Task[],
  externalUri: string | null,
  externalContent: string | null
): Promise<void> {
  return enqueueWrite(async () => {
    let localBackup: string | null = null;
    let externalBackup: string | null = null;
    
    try {
      // 1. Create backups
      const localInfo = await FileSystem.getInfoAsync(TASKS_FILE_URI);
      if (localInfo.exists) {
        localBackup = await FileSystem.readAsStringAsync(TASKS_FILE_URI);
      }
      
      if (externalUri) {
        const extInfo = await FileSystem.getInfoAsync(externalUri);
        if (extInfo.exists) {
          externalBackup = await FileSystem.readAsStringAsync(externalUri);
        }
      }
      
      // 2. Perform writes
      const localCsv = serializeTasksToCsv(localTasks);
      await FileSystem.writeAsStringAsync(TASKS_FILE_URI, localCsv);
      
      if (externalUri && externalContent !== null) {
        await FileSystem.writeAsStringAsync(externalUri, externalContent);
      }
      
      await writeToPermanentMirror(localCsv);
      
      await writeTraceLog(`[SYNC] Atomic reconciliation successful. Synchronized local database.`);
    } catch (error) {
      console.error('Reconciliation transaction failed, rolling back:', error);
      await writeTraceLog(`[ERROR] Sync reconciliation failed: ${String(error)}. Rolling back both targets.`);
      
      // 3. Rollback local
      if (localBackup !== null) {
        await FileSystem.writeAsStringAsync(TASKS_FILE_URI, localBackup);
      }
      // Rollback external
      if (externalUri && externalBackup !== null) {
        await FileSystem.writeAsStringAsync(externalUri, externalBackup);
      }
      
      throw new Error(`Sync transaction aborted due to write failures. Database rolled back.`);
    }
  });
}

/**
 * Creates a rolling system directory of five backup frames tracking database milestones.
 * Rotates legacy backups (backup_4.csv -> backup_5.csv, etc.) and writes current local
 * sandbox database to backup_1.csv.
 */
export async function rotateAndCreateBackup(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(TASKS_FILE_URI);
    if (!info.exists) return;
    const tasksContent = await FileSystem.readAsStringAsync(TASKS_FILE_URI);
    
    // Rotate backup files
    for (let i = 4; i >= 1; i--) {
      const sourceUri = FileSystem.documentDirectory + `backup_${i}.csv`;
      const destUri = FileSystem.documentDirectory + `backup_${i+1}.csv`;
      
      const sourceInfo = await FileSystem.getInfoAsync(sourceUri);
      if (sourceInfo.exists) {
        const destInfo = await FileSystem.getInfoAsync(destUri);
        if (destInfo.exists) {
          await FileSystem.deleteAsync(destUri, { idempotent: true });
        }
        await FileSystem.moveAsync({ from: sourceUri, to: destUri });
      }
    }
    
    // Write current state to backup_1.csv
    const backup1Uri = FileSystem.documentDirectory + 'backup_1.csv';
    await FileSystem.writeAsStringAsync(backup1Uri, tasksContent);
    await writeTraceLog('[BACKUP] Created rolling database backup snapshot (backup_1.csv).');
  } catch (err) {
    console.error('Failed to rotate and create backup:', err);
  }
}

/**
 * Lists the active local backup snapshot files with their modifications times and size metrics.
 */
export async function listBackups(): Promise<{ filename: string; timestamp: string; size: number }[]> {
  const backups: { filename: string; timestamp: string; size: number }[] = [];
  try {
    for (let i = 1; i <= 5; i++) {
      const filename = `backup_${i}.csv`;
      const backupUri = FileSystem.documentDirectory + filename;
      
      const info = await FileSystem.getInfoAsync(backupUri);
      if (info.exists) {
        let mtime = new Date().toLocaleString();
        if (info.modificationTime) {
          const mtimeMs = info.modificationTime * (info.modificationTime < 1000000000000 ? 1000 : 1);
          mtime = new Date(mtimeMs).toLocaleString();
        }
        backups.push({
          filename,
          timestamp: mtime,
          size: info.size || 0,
        });
      }
    }
  } catch (err) {
    console.error('Failed to list backups:', err);
  }
  return backups;
}

/**
 * Overwrites the active tasks database with the selected backup snapshot.
 */
export async function restoreFromBackup(backupName: string): Promise<void> {
  const backupUri = FileSystem.documentDirectory + backupName;
  const info = await FileSystem.getInfoAsync(backupUri);
  if (!info.exists) {
    throw new Error(`Backup file "${backupName}" does not exist.`);
  }
  
  const content = await FileSystem.readAsStringAsync(backupUri);
  await FileSystem.writeAsStringAsync(TASKS_FILE_URI, content);
  await writeTraceLog(`[BACKUP] Successfully restored tasks database from snapshot: ${backupName}`);
}

/**
 * Duplicates tasks.csv and completions.csv into safe_keeping_mirror/
 * strictly upon application initialization.
 */
export async function mirrorDatabaseFiles(): Promise<void> {
  try {
    const mirrorDirUri = FileSystem.documentDirectory + 'safe_keeping_mirror/';
    const dirInfo = await FileSystem.getInfoAsync(mirrorDirUri);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(mirrorDirUri, { intermediates: true });
    }

    const tasksMirrorUri = mirrorDirUri + 'tasks_mirror.csv';
    const completionsMirrorUri = mirrorDirUri + 'completions_mirror.csv';

    const tasksInfo = await FileSystem.getInfoAsync(TASKS_FILE_URI);
    if (tasksInfo.exists) {
      const tmInfo = await FileSystem.getInfoAsync(tasksMirrorUri);
      if (tmInfo.exists) {
        await FileSystem.deleteAsync(tasksMirrorUri, { idempotent: true });
      }
      await FileSystem.copyAsync({ from: TASKS_FILE_URI, to: tasksMirrorUri });
    }
    
    const completionsInfo = await FileSystem.getInfoAsync(COMPLETIONS_FILE_URI);
    if (completionsInfo.exists) {
      const cmInfo = await FileSystem.getInfoAsync(completionsMirrorUri);
      if (cmInfo.exists) {
        await FileSystem.deleteAsync(completionsMirrorUri, { idempotent: true });
      }
      await FileSystem.copyAsync({ from: COMPLETIONS_FILE_URI, to: completionsMirrorUri });
    }

    await writeTraceLog('[SYSTEM] Database files mirrored to safe_keeping_mirror/ successfully.');
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await writeTraceLog(`[ERROR] Database mirroring failure: ${errMsg}`);
    console.error('Database mirroring failure:', err);
  }
}

/**
 * Asynchronously duplicates task database content to the permanent mirror file, if configured.
 * Safely catches security-scope or validation errors if permissions expire.
 */
export async function writeToPermanentMirror(csvContent: string): Promise<void> {
  try {
    const uri = await AsyncStorage.getItem(PERMANENT_MIRROR_KEY);
    if (!uri) return;

    const file = new File(uri);
    if (!file.exists) {
      file.create();
    }
    file.write(csvContent);
    await writeTraceLog(`[SYNC] Permanent export mirror file updated successfully at: ${uri}`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await writeTraceLog(`[WARNING] Failed to write to permanent mirror: ${errMsg}. Permission scope may have expired. Please re-link in settings.`);
    console.warn('Failed to write to permanent mirror:', err);
  }
}

/**
 * Toggles completion status for multiple tasks in-memory and performs a single file system write.
 */
export async function batchToggleTasks(uuids: string[], completed: boolean): Promise<void> {
  return enqueueWrite(async () => {
    const currentTasks = await readTasks();
    const uuidSet = new Set(uuids);
    const completedDate = completed ? new Date().toISOString() : null;
    const updatedTasks = currentTasks.map(task => {
      if (uuidSet.has(task.uuid)) {
        return {
          ...task,
          completed,
          completed_date: completedDate,
        };
      }
      return task;
    });

    let logs = await readCompletions();
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (completed) {
      for (const uuid of uuids) {
        const task = currentTasks.find(t => t.uuid === uuid);
        if (task && !task.completed) {
          logs.push({
            taskId: uuid,
            completedDate: completedDate || new Date().toISOString(),
          });
        }
      }
    } else {
      logs = logs.filter(log => {
        const isTarget = uuidSet.has(log.taskId);
        const logDate = new Date(log.completedDate);
        const logDay = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}-${String(logDate.getDate()).padStart(2, '0')}`;
        return !(isTarget && logDay === todayStr);
      });
    }

    const tasksCsv = serializeTasksToCsv(updatedTasks);
    const completionsCsv = serializeCompletionsToCsv(logs);

    await FileSystem.writeAsStringAsync(TASKS_FILE_URI, tasksCsv);
    await FileSystem.writeAsStringAsync(COMPLETIONS_FILE_URI, completionsCsv);
    await writeToPermanentMirror(tasksCsv);
  });
}

export async function batchDeleteTasks(uuids: string[]): Promise<void> {
  return enqueueWrite(async () => {
    const currentTasks = await readTasks();
    const uuidSet = new Set(uuids);
    const updatedTasks = currentTasks.map(task => {
      if (uuidSet.has(task.uuid)) {
        return {
          ...task,
          deleted: true,
        };
      }
      return task;
    });

    const csvContent = serializeTasksToCsv(updatedTasks);
    await FileSystem.writeAsStringAsync(TASKS_FILE_URI, csvContent);
    await writeToPermanentMirror(csvContent);
  });
}

/**
 * Changes type (daily vs onetime) for multiple tasks in-memory and commits a single file system write.
 */
export async function batchRescheduleTasks(uuids: string[], type: TaskType): Promise<void> {
  return enqueueWrite(async () => {
    const currentTasks = await readTasks();
    const uuidSet = new Set(uuids);
    const updatedTasks = currentTasks.map(task => {
      if (uuidSet.has(task.uuid)) {
        return {
          ...task,
          type,
        };
      }
      return task;
    });

    const csvContent = serializeTasksToCsv(updatedTasks);
    await FileSystem.writeAsStringAsync(TASKS_FILE_URI, csvContent);
    await writeToPermanentMirror(csvContent);
  });
}

/**
 * Updates alerts/alarms for multiple tasks in-memory and commits a single file system write.
 */
export async function batchUpdateAlerts(uuids: string[], alerts: string[]): Promise<void> {
  return enqueueWrite(async () => {
    const currentTasks = await readTasks();
    const uuidSet = new Set(uuids);
    const updatedTasks = currentTasks.map(task => {
      if (uuidSet.has(task.uuid)) {
        return {
          ...task,
          alerts,
        };
      }
      return task;
    });

    const csvContent = serializeTasksToCsv(updatedTasks);
    await FileSystem.writeAsStringAsync(TASKS_FILE_URI, csvContent);
    await writeToPermanentMirror(csvContent);
  });
}



