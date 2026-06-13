import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { Fonts } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Import our Checklist domain boundary components and hooks
import {
  useTaskEngine,
  Task,
  TaskType,
  TaskItem,
  TaskForm,
  BatchAlertForm,
} from '@/src/features/checklist';

type FilterType = 'all' | 'daily' | 'onetime';

export default function ChecklistScreen() {
  const {
    tasks,
    loading,
    error,
    refetch,
    addTask,
    toggleTask,
    deleteTask,
    updateTaskAlerts,
  } = useTaskEngine();

  const [filter, setFilter] = useState<FilterType>('all');
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Memoize task filtering to optimize rendering performance
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (filter === 'daily') return task.type === 'daily';
      if (filter === 'onetime') return task.type === 'onetime';
      return true;
    });
  }, [tasks, filter]);

  // Callbacks for Task mutations, wrapped with useCallback to avoid re-renders
  const handleToggle = useCallback(async (id: string) => {
    await toggleTask(id);
  }, [toggleTask]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteTask(id);
  }, [deleteTask]);

  const handleConfigureAlerts = useCallback((task: Task) => {
    setEditingTask(task);
  }, []);

  const handleCloseAlertsForm = useCallback(() => {
    setEditingTask(null);
  }, []);

  const handleSaveAlerts = useCallback(async (taskId: string, alerts: string[]) => {
    await updateTaskAlerts(taskId, alerts);
    setEditingTask(null);
  }, [updateTaskAlerts]);

  const handleAddTask = useCallback(async (title: string, type: TaskType) => {
    await addTask(title, type);
  }, [addTask]);

  // Async state 1: Loading
  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Reading checklist from storage...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Async state 2: Error
  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <IconSymbol name="bell.fill" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refetch}>
            <Text style={styles.retryText}>Retry Loading</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Header Panel */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>My Tasks</Text>
          <View style={styles.taskCountBadge}>
            <Text style={styles.taskCountText}>
              {tasks.filter(t => t.completed).length}/{tasks.length}
            </Text>
          </View>
        </View>
        <Text style={styles.headerSubtitle}>Keep track of your execution goals</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {(['all', 'daily', 'onetime'] as FilterType[]).map(tab => (
          <TouchableOpacity
            key={tab}
            activeOpacity={0.7}
            style={[
              styles.filterTab,
              filter === tab && styles.filterTabActive,
            ]}
            onPress={() => setFilter(tab)}
          >
            <Text
              style={[
                styles.filterTabText,
                filter === tab && styles.filterTabTextActive,
              ]}
            >
              {tab.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Checklist Tasks - Success / Empty list wrapper */}
      <View style={styles.listContainer}>
        {filteredTasks.length === 0 ? (
          // Async state 3: Empty State
          <View style={styles.emptyContainer}>
            <IconSymbol name="checkmark.circle.fill" size={64} color="#2C2C2E" />
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'all'
                ? 'Create a recurring daily or one-time checklist goal to get started.'
                : `No active ${filter} tasks found.`}
            </Text>
            {filter === 'all' && (
              <TouchableOpacity
                style={styles.emptyCtaButton}
                activeOpacity={0.8}
                onPress={() => setIsFormVisible(true)}
              >
                <Text style={styles.emptyCtaText}>Create First Task</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          // Async state 4: Success State (Recycler List)
          <FlashList
            data={filteredTasks}
            renderItem={({ item }) => (
              <TaskItem
                task={item}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onConfigureAlerts={handleConfigureAlerts}
              />
            )}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>

      {/* Floating Action Button (FAB) */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => setIsFormVisible(true)}
      >
        <IconSymbol name="plus" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Add Task Modal Form */}
      <TaskForm
        visible={isFormVisible}
        onClose={() => setIsFormVisible(false)}
        onSave={handleAddTask}
      />

      {/* Alerts Scheduler Modal Form */}
      {editingTask && (
        <BatchAlertForm
          task={editingTask}
          onClose={handleCloseAlertsForm}
          onSaveAlerts={handleSaveAlerts}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#151718',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#9BA1A6',
    marginTop: 16,
    fontSize: 14,
    fontFamily: Fonts.sans,
  },
  errorText: {
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 20,
    fontSize: 14,
    fontFamily: Fonts.sans,
  },
  retryButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ECEDEE',
    fontFamily: Fonts.rounded,
  },
  taskCountBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  taskCountText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: Fonts.mono,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#9BA1A6',
    marginTop: 4,
    fontFamily: Fonts.sans,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#1E1E20',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  filterTabActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
  },
  filterTabText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#9BA1A6',
    fontFamily: Fonts.sans,
  },
  filterTabTextActive: {
    color: '#10B981',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 90,
  },
  emptyContainer: {
    flex: 0.8,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ECEDEE',
    marginTop: 16,
    fontFamily: Fonts.rounded,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#687076',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
    fontFamily: Fonts.sans,
  },
  emptyCtaButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 24,
  },
  emptyCtaText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
    fontFamily: Fonts.sans,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
});