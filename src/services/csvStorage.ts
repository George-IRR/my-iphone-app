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

/**
 * Serializes task items array into CSV string.
 */
export function serializeTasksToCsv(tasks: Task[]): string {
  const header = 'id,title,type,completed,completed_date,created_date,alerts';
  const lines = tasks.map(task => {
    const id = escapeCsvValue(task.id);
    const title = escapeCsvValue(task.title);
    const type = escapeCsvValue(task.type);
    const completed = escapeCsvValue(task.completed ? 'true' : 'false');
    const completedDate = escapeCsvValue(task.completed_date);
    const createdDate = escapeCsvValue(task.created_date);
    const alerts = escapeCsvValue(JSON.stringify(task.alerts));
    return `${id},${title},${type},${completed},${completedDate},${createdDate},${alerts}`;
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
  const idIdx = header.indexOf('id');
  const titleIdx = header.indexOf('title');
  const typeIdx = header.indexOf('type');
  const completedIdx = header.indexOf('completed');
  const completedDateIdx = header.indexOf('completed_date');
  const createdDateIdx = header.indexOf('created_date');
  const alertsIdx = header.indexOf('alerts');
  
  if (idIdx === -1 || titleIdx === -1 || typeIdx === -1 || completedIdx === -1) {
    console.error('CSV Header layout is invalid:', header);
    return [];
  }
  
  const tasks: Task[] = [];
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 4) continue; // Skip severely malformed lines
    
    const id = row[idIdx] || '';
    const title = row[titleIdx] || '';
    const type = (row[typeIdx] === 'daily' ? 'daily' : 'onetime');
    const completed = row[completedIdx] === 'true';
    const completed_date = completedDateIdx !== -1 ? (row[completedDateIdx] || null) : null;
    const created_date = createdDateIdx !== -1 ? (row[createdDateIdx] || new Date().toISOString()) : new Date().toISOString();
    
    let alerts: string[] = [];
    if (alertsIdx !== -1 && row[alertsIdx]) {
      try {
        const parsed = JSON.parse(row[alertsIdx]);
        if (Array.isArray(parsed)) {
          alerts = parsed.map(String);
        }
      } catch {
        alerts = [];
      }
    }
    
    tasks.push({
      id,
      title,
      type,
      completed,
      completed_date,
      created_date,
      alerts,
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

export async function writeTasks(tasks: Task[]): Promise<void> {
  try {
    const csvContent = serializeTasksToCsv(tasks);
    await FileSystem.writeAsStringAsync(TASKS_FILE_URI, csvContent);
  } catch (error) {
    console.error('Error writing tasks CSV:', error);
  }
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
  try {
    const csvContent = serializeCompletionsToCsv(logs);
    await FileSystem.writeAsStringAsync(COMPLETIONS_FILE_URI, csvContent);
  } catch (error) {
    console.error('Error writing completions CSV:', error);
  }
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
