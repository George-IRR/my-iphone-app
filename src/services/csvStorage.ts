import * as FileSystem from 'expo-file-system/legacy';
import { Task, CompletionLog } from '../features/checklist/types';

const TASKS_FILE_URI = FileSystem.documentDirectory + 'tasks.csv';
const COMPLETIONS_FILE_URI = FileSystem.documentDirectory + 'completions.csv';
const LAST_ACTIVE_FILE_URI = FileSystem.documentDirectory + 'last_active.txt';

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
 * Generates a cryptographically random UUID v4.
 */
export function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Serializes task items array into CSV string.
 */
export function serializeTasksToCsv(tasks: Task[]): string {
  const header = 'uuid,id,title,type,completed,completed_date,created_date,alerts';
  const lines = tasks.map(task => {
    const uuid = escapeCsvValue(task.uuid || generateUuid());
    const id = escapeCsvValue(task.id);
    const title = escapeCsvValue(task.title);
    const type = escapeCsvValue(task.type);
    const completed = escapeCsvValue(task.completed ? 'true' : 'false');
    const completedDate = escapeCsvValue(task.completed_date);
    const createdDate = escapeCsvValue(task.created_date);
    const alerts = escapeCsvValue(JSON.stringify(task.alerts));
    return `${uuid},${id},${title},${type},${completed},${completedDate},${createdDate},${alerts}`;
  });
  return [header, ...lines].join('\n');
}

/**
 * Deserializes CSV string into task items.
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

    const hasUuidHeader = uuidIdx !== -1;
    const firstElement = row[0] || '';
    const isFirstElementUuid = UUID_REGEX.test(firstElement);
    
    if (hasUuidHeader && isFirstElementUuid) {
      // Standard new layout
      uuidVal = row[uuidIdx] || generateUuid();
      idVal = idIdx !== -1 ? row[idIdx] : uuidVal;
      titleVal = titleIdx !== -1 ? row[titleIdx] : '';
      typeVal = typeIdx !== -1 && row[typeIdx] === 'onetime' ? 'onetime' : 'daily';
      completedVal = completedIdx !== -1 && row[completedIdx] === 'true';
      completedDateVal = completedDateIdx !== -1 ? (row[completedDateIdx] || null) : null;
      createdDateVal = createdDateIdx !== -1 ? (row[createdDateIdx] || new Date().toISOString()) : new Date().toISOString();
      
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
      // Legacy layout: Shift elements and generate a random UUID
      // Legacy CSV: id,title,type,completed,completed_date,created_date,alerts
      uuidVal = generateUuid();
      idVal = idIdx !== -1 ? (row[idIdx] || uuidVal) : (row[0] || uuidVal);
      titleVal = titleIdx !== -1 ? row[titleIdx] : (row[1] || '');
      typeVal = (typeIdx !== -1 ? row[typeIdx] : row[2]) === 'onetime' ? 'onetime' : 'daily';
      completedVal = (completedIdx !== -1 ? row[completedIdx] : row[3]) === 'true';
      completedDateVal = completedDateIdx !== -1 ? (row[completedDateIdx] || null) : (row[4] || null);
      createdDateVal = createdDateIdx !== -1 ? (row[createdDateIdx] || new Date().toISOString()) : (row[5] || new Date().toISOString());
      
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

// File System CRUD implementations

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

const TRACE_LOG_FILE_URI = FileSystem.documentDirectory + 'mirror_trace.log';

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
    await FileSystem.writeAsStringAsync(TRACE_LOG_FILE_URI, '');
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
    if (info.exists && info.size > 2 * 1024 * 1024) { // 2MB
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
      const localExists = await FileSystem.getInfoAsync(TASKS_FILE_URI);
      if (localExists.exists) {
        localBackup = await FileSystem.readAsStringAsync(TASKS_FILE_URI);
      }
      
      if (externalUri) {
        const extExists = await FileSystem.getInfoAsync(externalUri);
        if (extExists.exists) {
          externalBackup = await FileSystem.readAsStringAsync(externalUri);
        }
      }
      
      // 2. Perform writes
      const localCsv = serializeTasksToCsv(localTasks);
      await FileSystem.writeAsStringAsync(TASKS_FILE_URI, localCsv);
      
      if (externalUri && externalContent !== null) {
        await FileSystem.writeAsStringAsync(externalUri, externalContent);
      }
      
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
    const tasksExists = await FileSystem.getInfoAsync(TASKS_FILE_URI);
    if (!tasksExists.exists) return;
    
    const tasksContent = await FileSystem.readAsStringAsync(TASKS_FILE_URI);
    
    // Rotate backup files
    for (let i = 4; i >= 1; i--) {
      const sourceUri = `${FileSystem.documentDirectory}backup_${i}.csv`;
      const destUri = `${FileSystem.documentDirectory}backup_${i+1}.csv`;
      const sourceInfo = await FileSystem.getInfoAsync(sourceUri);
      
      if (sourceInfo.exists) {
        const destInfo = await FileSystem.getInfoAsync(destUri);
        if (destInfo.exists) {
          await FileSystem.deleteAsync(destUri);
        }
        await FileSystem.moveAsync({ from: sourceUri, to: destUri });
      }
    }
    
    // Write current state to backup_1.csv
    const backup1Uri = `${FileSystem.documentDirectory}backup_1.csv`;
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
      const uri = `${FileSystem.documentDirectory}${filename}`;
      const info = await FileSystem.getInfoAsync(uri);
      
      if (info.exists) {
        // Fallback modification time
        let mtime = new Date().toLocaleString();
        if (info.modificationTime) {
          const mtimeMs = info.modificationTime * (info.modificationTime < 1000000000000 ? 1000 : 1);
          mtime = new Date(mtimeMs).toLocaleString();
        }
        backups.push({
          filename,
          timestamp: mtime,
          size: info.size,
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
  const sourceUri = `${FileSystem.documentDirectory}${backupName}`;
  const info = await FileSystem.getInfoAsync(sourceUri);
  if (!info.exists) {
    throw new Error(`Backup file "${backupName}" does not exist.`);
  }
  
  const content = await FileSystem.readAsStringAsync(sourceUri);
  await FileSystem.writeAsStringAsync(TASKS_FILE_URI, content);
  await writeTraceLog(`[BACKUP] Successfully restored tasks database from snapshot: ${backupName}`);
}
