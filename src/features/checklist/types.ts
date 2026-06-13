export type TaskType = 'daily' | 'onetime';

export interface Task {
  uuid: string;
  id: string;
  title: string;
  type: TaskType;
  completed: boolean;
  completed_date: string | null;
  created_date: string;
  alerts: string[]; // Array of alert strings (e.g. "time:08:30", "datetime:...", "offset:...")
  deleted?: boolean;
}

export interface CompletionLog {
  taskId: string;
  completedDate: string; // ISO String of when it was completed
}

export type AlertDefinition =
  | { type: 'time'; value: string } // "HH:MM" for daily repeating alarms
  | { type: 'datetime'; value: string } // ISO String for one-time alarms
  | { type: 'offset'; value: number }; // Relative offset in seconds
