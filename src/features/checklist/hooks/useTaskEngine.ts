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
          // A calendar day boundary has crossed! Reset daily tasks.
          updatedTasks = activeTasks.map(task => {
            if (task.type === 'daily') {
              return {
                ...task,
                completed: false,
                completed_date: null,
              };
            }
            return task;
          });
          didReset = true;
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

  const toggleTask = async (id: string) => {
    try {
      setError(null);
      const updatedTasks = tasks.map(task => {
        if (task.id === id) {
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

      const toggledTask = updatedTasks.find(t => t.id === id);
      if (!toggledTask) return;

      // Update completions history logs
      let logs = await readCompletions();
      if (toggledTask.completed) {
        logs.push({
          taskId: id,
          completedDate: toggledTask.completed_date || new Date().toISOString(),
        });
      } else {
        // Remove completion entry for today
        const todayStr = new Date().toISOString().split('T')[0];
        logs = logs.filter(log => {
          const isThisTask = log.taskId === id;
          const logDay = log.completedDate.split('T')[0];
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

  const deleteTask = async (id: string) => {
    try {
      setError(null);
      const updatedTasks = tasks.filter(task => task.id !== id);

      // Cancel associated system alerts
      await cancelTaskNotifications(id);

      await writeTasks(updatedTasks);
      setTasks(updatedTasks);
    } catch (err) {
      console.error('Failed to delete task:', err);
      setError('Failed to delete task item.');
    }
  };

  const updateTaskAlerts = async (id: string, alerts: string[]) => {
    try {
      setError(null);
      const taskIndex = tasks.findIndex(t => t.id === id);
      if (taskIndex === -1) return;

      const targetTask = tasks[taskIndex];
      const updatedTask = { ...targetTask, alerts };
      const updatedTasks = [...tasks];
      updatedTasks[taskIndex] = updatedTask;

      // Reschedule alerts in notification engine
      await scheduleTaskNotifications(id, targetTask.title, alerts);

      await writeTasks(updatedTasks);
      setTasks(updatedTasks);
    } catch (err) {
      console.error('Failed to update task notifications:', err);
      setError('Failed to update task alerts.');
    }
  };

  return {
    tasks,
    loading,
    error,
    refetch: loadTasksData,
    addTask,
    toggleTask,
    deleteTask,
    updateTaskAlerts,
  };
}
