import { useState, useEffect, useCallback } from 'react';
import { CompletionLog } from '../../checklist';
import { readCompletions } from '../../../services/csvStorage';

export function useHeatmapData() {
  const [completions, setCompletions] = useState<CompletionLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const logs = await readCompletions();
      setCompletions(logs);
    } catch (err) {
      console.error('Failed to load completion logs:', err);
      setError('Could not retrieve task execution logs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  /**
   * Compiles and groups completions counts by calendar date.
   * Returns a dictionary: "YYYY-MM-DD" -> count of completed tasks
   */
  const getCompletionCounts = useCallback((): Record<string, number> => {
    const counts: Record<string, number> = {};
    for (const log of completions) {
      if (!log.completedDate) continue;
      const dateObj = new Date(log.completedDate);
      if (isNaN(dateObj.getTime())) continue;
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;
      counts[dateKey] = (counts[dateKey] || 0) + 1;
    }
    return counts;
  }, [completions]);

  return {
    completions,
    loading,
    error,
    refetch: loadLogs,
    completionCounts: getCompletionCounts(),
  };
}
