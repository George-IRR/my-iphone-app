import { useCallback } from 'react';
import { requestNotificationPermissions } from '../../../services/notificationService';

export function useNotificationEngine() {
  /**
   * Prompts user for system notification permissions.
   */
  const checkAndRequestPermissions = useCallback(async () => {
    return await requestNotificationPermissions();
  }, []);

  /**
   * Formats string representation times (e.g. ["09:30", "18:00"]) into CSV schema format "time:HH:MM".
   */
  const createDailyAlarmAlerts = useCallback((times: string[]): string[] => {
    const alerts: string[] = [];
    for (const time of times) {
      const parts = time.split(':');
      if (parts.length === 2) {
        const hour = parseInt(parts[0], 10);
        const minute = parseInt(parts[1], 10);
        if (!isNaN(hour) && hour >= 0 && hour < 24 && !isNaN(minute) && minute >= 0 && minute < 60) {
          const hourStr = String(hour).padStart(2, '0');
          const minStr = String(minute).padStart(2, '0');
          alerts.push(`time:${hourStr}:${minStr}`);
        }
      }
    }
    return alerts;
  }, []);

  /**
   * Maps multiple relative offsets (e.g. every X hours, Y times) into CSV schema format "offset:SECONDS".
   */
  const createOffsetIntervalAlerts = useCallback((intervalHours: number, count: number): string[] => {
    const alerts: string[] = [];
    if (intervalHours <= 0 || count <= 0) return [];
    
    for (let i = 1; i <= count; i++) {
      const offsetSeconds = i * intervalHours * 3600;
      alerts.push(`offset:${offsetSeconds}`);
    }
    return alerts;
  }, []);

  /**
   * Formats date targets into CSV schema format "datetime:ISO_STRING".
   */
  const createSpecificDateAlerts = useCallback((dates: Date[]): string[] => {
    return dates
      .filter(d => d.getTime() > Date.now())
      .map(d => `datetime:${d.toISOString()}`);
  }, []);

  return {
    checkAndRequestPermissions,
    createDailyAlarmAlerts,
    createOffsetIntervalAlerts,
    createSpecificDateAlerts,
  };
}
