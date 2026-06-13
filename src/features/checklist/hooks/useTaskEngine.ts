import { useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import { Task, TaskType } from '../types';
import {
  readTasks,
  writeTasks,
  readCompletions,
  writeCompletions,
  readLastActiveDate,
  writeLastActiveDate,
  enforceLogSizeLimit,
  generateUuid,
  mirrorDatabaseFiles,
  batchToggleTasks,
  batchDeleteTasks,
  batchRescheduleTasks,
  batchUpdateAlerts,
} from '../../../services/csvStorage';
import {
  scheduleTaskNotifications,
  cancelTaskNotifications,
} from '../../../services/notificationService';

export function useTaskEngine() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadTasksData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Enforce trace log size cap validation on app initialization
      await enforceLogSizeLimit();

      const lastActive = await readLastActiveDate();
      const activeTasks = await readTasks();

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      let updatedTasks = [...activeTasks];
      let didReset = false;

      if (lastActive) {
        if (lastActive !== todayStr) {
          // A calendar day boundary has crossed! Group daily tasks by ID and check the latest instance.
          const tasksById = new Map<string, Task[]>();
          for (const task of activeTasks) {
            if (!tasksById.has(task.id)) {
              tasksById.set(task.id, []);
            }
            tasksById.get(task.id)!.push(task);
          }

          const newCopies: Task[] = [];
          for (const instances of tasksById.values()) {
            const sorted = [...instances].sort((a, b) => {
              const timeA = a.created_date ? new Date(a.created_date).getTime() : 0;
              const timeB = b.created_date ? new Date(b.created_date).getTime() : 0;
              return timeB - timeA;
            });
            const latest = sorted[0];

            if (latest && latest.type === 'daily' && latest.completed && !latest.deleted) {
              newCopies.push({
                uuid: generateUuid(),
                id: latest.id,
                title: latest.title,
                type: 'daily',
                completed: false,
                completed_date: null,
                created_date: new Date().toISOString(),
                alerts: latest.alerts,
              });
            }
          }

          if (newCopies.length > 0) {
            updatedTasks = [...activeTasks, ...newCopies];
            didReset = true;
          }
        }
      }

      if (didReset || !lastActive) {
        await writeTasks(updatedTasks);
        await writeLastActiveDate(todayStr);

        // Prune completion logs older than 365 days to prevent file size inflation
        try {
          const logs = await readCompletions();
          const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
          const prunedLogs = logs.filter(log => {
            const logTime = new Date(log.completedDate).getTime();
            return isNaN(logTime) || logTime >= oneYearAgo;
          });
          if (prunedLogs.length !== logs.length) {
            await writeCompletions(prunedLogs);
          }
        } catch (pruneErr) {
          console.error('Failed to prune completions history:', pruneErr);
        }
      }

      setTasks(updatedTasks);
      
      // Perform 1:1 safe-keeping database mirroring asynchronously
      mirrorDatabaseFiles().catch(err => {
        console.error('Asynchronous database mirroring failed:', err);
      });
    } catch (err) {
      console.error('Failed to load tasks checklist:', err);
      setError('Failed to retrieve checklist database.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasksData();

    // Listen to AppState transitions (e.g. background to active) to evaluate midnight boundary reset
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        loadTasksData();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [loadTasksData]);

  const addTask = async (title: string, type: TaskType, alerts: string[] = []) => {
    try {
      setError(null);
      const taskId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newTask: Task = {
        uuid: generateUuid(),
        id: taskId,
        title: title.trim(),
        type,
        completed: false,
        completed_date: null,
        created_date: new Date().toISOString(),
        alerts,
      };

      const updatedTasks = [...tasks, newTask];
      
      // Schedule notifications for the new task
      if (alerts.length > 0) {
        await scheduleTaskNotifications(taskId, newTask.title, alerts);
      }

      await writeTasks(updatedTasks);
      setTasks(updatedTasks);
    } catch (err) {
      console.error('Failed to add task:', err);
      setError('Could not save the new task.');
    }
  };

  const toggleTask = async (uuid: string) => {
    try {
      setError(null);
      const updatedTasks = tasks.map(task => {
        if (task.uuid === uuid) {
          const nextCompleted = !task.completed;
          const completedDate = nextCompleted ? new Date().toISOString() : null;
          return {
            ...task,
            completed: nextCompleted,
            completed_date: completedDate,
          };
        }
        return task;
      });

      const toggledTask = updatedTasks.find(t => t.uuid === uuid);
      if (!toggledTask) return;

      // Update completions history logs
      let logs = await readCompletions();
      if (toggledTask.completed) {
        logs.push({
          taskId: toggledTask.uuid,
          completedDate: toggledTask.completed_date || new Date().toISOString(),
        });
      } else {
        // Remove completion entry for today (local date comparison)
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        logs = logs.filter(log => {
          const isThisTask = log.taskId === toggledTask.uuid;
          const logDate = new Date(log.completedDate);
          const logDay = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}-${String(logDate.getDate()).padStart(2, '0')}`;
          return !(isThisTask && logDay === todayStr);
        });
      }

      await writeCompletions(logs);
      await writeTasks(updatedTasks);
      setTasks(updatedTasks);
    } catch (err) {
      console.error('Failed to toggle task:', err);
      setError('Failed to toggle task status.');
    }
  };

  const deleteTask = async (uuid: string) => {
    try {
      setError(null);
      const targetTask = tasks.find(t => t.uuid === uuid);
      if (!targetTask) return;

      const updatedTasks = tasks.map(task => {
        if (task.uuid === uuid) {
          return { ...task, deleted: true };
        }
        return task;
      });

      // Cancel associated system alerts (using local task.id)
      await cancelTaskNotifications(targetTask.id);

      await writeTasks(updatedTasks);
      setTasks(updatedTasks);
    } catch (err) {
      console.error('Failed to delete task:', err);
      setError('Failed to delete task item.');
    }
  };

  const updateTaskAlerts = async (uuid: string, alerts: string[]) => {
    try {
      setError(null);
      const taskIndex = tasks.findIndex(t => t.uuid === uuid);
      if (taskIndex === -1) return;

      const targetTask = tasks[taskIndex];
      const updatedTask = { ...targetTask, alerts };
      const updatedTasks = [...tasks];
      updatedTasks[taskIndex] = updatedTask;

      // Reschedule alerts in notification engine (using local task.id)
      await scheduleTaskNotifications(targetTask.id, targetTask.title, alerts);

      await writeTasks(updatedTasks);
      setTasks(updatedTasks);
    } catch (err) {
      console.error('Failed to update task notifications:', err);
      setError('Failed to update task alerts.');
    }
  };

  const batchToggle = async (uuids: string[], completed: boolean) => {
    try {
      setError(null);
      await batchToggleTasks(uuids, completed);
      const completedDate = completed ? new Date().toISOString() : null;
      const uuidSet = new Set(uuids);
      setTasks(prev => prev.map(task => {
        if (uuidSet.has(task.uuid)) {
          return { ...task, completed, completed_date: completedDate };
        }
        return task;
      }));
    } catch (err) {
      console.error('Failed to batch toggle tasks:', err);
      setError('Failed to batch toggle status.');
    }
  };

  const batchDelete = async (uuids: string[]) => {
    try {
      setError(null);
      await batchDeleteTasks(uuids);
      for (const uuid of uuids) {
        const task = tasks.find(t => t.uuid === uuid);
        if (task) {
          await cancelTaskNotifications(task.id);
        }
      }
      const uuidSet = new Set(uuids);
      setTasks(prev => prev.map(task => {
        if (uuidSet.has(task.uuid)) {
          return { ...task, deleted: true };
        }
        return task;
      }));
    } catch (err) {
      console.error('Failed to batch delete tasks:', err);
      setError('Failed to batch delete tasks.');
    }
  };

  const batchReschedule = async (uuids: string[], type: TaskType) => {
    try {
      setError(null);
      await batchRescheduleTasks(uuids, type);
      const uuidSet = new Set(uuids);
      setTasks(prev => prev.map(task => {
        if (uuidSet.has(task.uuid)) {
          return { ...task, type };
        }
        return task;
      }));
    } catch (err) {
      console.error('Failed to batch reschedule tasks:', err);
      setError('Failed to batch reschedule tasks.');
    }
  };

  const batchAlerts = async (uuids: string[], alerts: string[]) => {
    try {
      setError(null);
      await batchUpdateAlerts(uuids, alerts);
      for (const uuid of uuids) {
        const task = tasks.find(t => t.uuid === uuid);
        if (task) {
          await scheduleTaskNotifications(task.id, task.title, alerts);
        }
      }
      const uuidSet = new Set(uuids);
      setTasks(prev => prev.map(task => {
        if (uuidSet.has(task.uuid)) {
          return { ...task, alerts };
        }
        return task;
      }));
    } catch (err) {
      console.error('Failed to batch update alerts:', err);
      setError('Failed to batch update alerts.');
    }
  };

  const activeTasksList = tasks.filter(task => {
    if (task.deleted) return false;
    if (task.completed && task.completed_date) {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const compDate = new Date(task.completed_date);
      const compDateStr = `${compDate.getFullYear()}-${String(compDate.getMonth() + 1).padStart(2, '0')}-${String(compDate.getDate()).padStart(2, '0')}`;
      return compDateStr === todayStr;
    }
    return true;
  });

  return {
    tasks: activeTasksList,
    loading,
    error,
    refetch: loadTasksData,
    addTask,
    toggleTask,
    deleteTask,
    updateTaskAlerts,
    batchToggleTasks: batchToggle,
    batchDeleteTasks: batchDelete,
    batchRescheduleTasks: batchReschedule,
    batchUpdateAlerts: batchAlerts,
  };
}
