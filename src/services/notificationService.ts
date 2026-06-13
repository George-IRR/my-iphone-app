import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure default notification behaviors for the application
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Requests native notification permissions from the system.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      return false;
    }
    
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#10B981',
      });
    }
    
    return true;
  } catch (error) {
    console.error('Failed to request notification permission:', error);
    return false;
  }
}

/**
 * Cancels all scheduled notifications registered for a specific task ID.
 */
export async function cancelTaskNotifications(taskId: string): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduled) {
      if (notification.content.data?.taskId === taskId) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
  } catch (error) {
    console.error(`Failed to cancel notifications for task ${taskId}:`, error);
  }
}

/**
 * Schedules native local notifications from alert strings definition array.
 */
export async function scheduleTaskNotifications(
  taskId: string,
  taskTitle: string,
  alertStrings: string[]
): Promise<void> {
  // 1. Cancel previous alerts for this task to avoid duplicates
  await cancelTaskNotifications(taskId);
  
  if (!alertStrings || alertStrings.length === 0) return;
  
  // 2. Request permission first
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    console.warn('Notifications permission not granted. Alarms will not schedule.');
    return;
  }
  
  // 3. Register each alert string
  for (const alertStr of alertStrings) {
    try {
      if (alertStr.startsWith('time:')) {
        // Daily recurring at HH:MM
        const timePart = alertStr.substring(5); // "HH:MM"
        const [hourStr, minStr] = timePart.split(':');
        const hour = parseInt(hourStr, 10);
        const minute = parseInt(minStr, 10);
        
        if (isNaN(hour) || isNaN(minute)) continue;
        
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Checklist Alert',
            body: `It's time to do: "${taskTitle}"`,
            data: { taskId, alertStr },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            hour,
            minute,
            repeats: true,
          },
        });
      } else if (alertStr.startsWith('datetime:')) {
        // One-time date ISO
        const datePart = alertStr.substring(9);
        const date = new Date(datePart);
        
        if (isNaN(date.getTime()) || date.getTime() <= Date.now()) {
          // Skip invalid dates or dates in the past
          continue;
        }
        
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Checklist Reminder',
            body: `Scheduled alarm for: "${taskTitle}"`,
            data: { taskId, alertStr },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date,
          },
        });
      } else if (alertStr.startsWith('offset:')) {
        // One-time delay offset in seconds
        const offsetPart = alertStr.substring(7);
        const offsetSeconds = parseInt(offsetPart, 10);
        
        if (isNaN(offsetSeconds) || offsetSeconds <= 0) continue;
        
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Checklist Alarm',
            body: `Interval reminder for: "${taskTitle}"`,
            data: { taskId, alertStr },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: offsetSeconds,
            repeats: false,
          },
        });
      }
    } catch (err) {
      console.error(`Error scheduling notification for alert "${alertStr}":`, err);
    }
  }
}
