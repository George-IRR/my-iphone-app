import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { Fonts } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Import our Checklist domain boundary components and hooks
import {
  useTaskEngine,
  Task,
  TaskType,
} from '@/src/features/checklist';
import { TaskItem } from '@/src/features/checklist/components/TaskItem';
import { TaskForm } from '@/src/features/checklist/components/TaskForm';
import { BatchAlertForm } from '@/src/features/checklist/components/BatchAlertForm';

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
    batchToggleTasks,
    batchDeleteTasks,
    batchRescheduleTasks,
    batchUpdateAlerts,
  } = useTaskEngine();

  const [filter, setFilter] = useState<FilterType>('all');
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Search and Multi-select states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [isBatchAlertsVisible, setIsBatchAlertsVisible] = useState(false);

  // Memoize task filtering to optimize rendering performance, with safe Regex filter
  const filteredTasks = useMemo(() => {
    let result = tasks.filter(task => {
      if (filter === 'daily') return task.type === 'daily';
      if (filter === 'onetime') return task.type === 'onetime';
      return true;
    });

    if (searchQuery.trim() !== '') {
      try {
        // Attempt compilation of user search constraints
        const regex = new RegExp(searchQuery, 'i');
        result = result.filter(task => regex.test(task.title));
      } catch {
        // Graceful fallback to substring scanning if compilation throws
        const normalizedQuery = searchQuery.toLowerCase();
        result = result.filter(task => task.title.toLowerCase().includes(normalizedQuery));
      }
    }

    return result;
  }, [tasks, filter, searchQuery]);

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
    setIsBatchAlertsVisible(false);
  }, []);

  const handleSaveAlerts = useCallback(async (taskId: string, alerts: string[]) => {
    if (taskId === 'batch_selection') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await batchUpdateAlerts(Array.from(selectedTaskIds), alerts);
      setSelectedTaskIds(new Set());
      setIsMultiSelectMode(false);
    } else {
      await updateTaskAlerts(taskId, alerts);
    }
    setEditingTask(null);
    setIsBatchAlertsVisible(false);
  }, [updateTaskAlerts, batchUpdateAlerts, selectedTaskIds]);

  const handleAddTask = useCallback(async (title: string, type: TaskType) => {
    await addTask(title, type);
  }, [addTask]);

  // Selection handlers
  const handleSelect = useCallback((uuid: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(uuid)) {
        next.delete(uuid);
      } else {
        next.add(uuid);
      }
      
      if (next.size === 0) {
        setIsMultiSelectMode(false);
      }
      return next;
    });
  }, []);

  const handleLongPress = useCallback((uuid: string) => {
    setIsMultiSelectMode(true);
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      next.add(uuid);
      return next;
    });
  }, []);

  // Batch actions
  const handleBatchToggleComplete = useCallback(async () => {
    if (selectedTaskIds.size === 0) return;
    const selectedTasks = tasks.filter(t => selectedTaskIds.has(t.uuid));
    const allCompleted = selectedTasks.every(t => t.completed);
    const nextCompleted = !allCompleted;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await batchToggleTasks(Array.from(selectedTaskIds), nextCompleted);
    setSelectedTaskIds(new Set());
    setIsMultiSelectMode(false);
  }, [selectedTaskIds, tasks, batchToggleTasks]);

  const handleBatchReschedule = useCallback(async () => {
    if (selectedTaskIds.size === 0) return;
    Alert.alert(
      'Batch Reschedule Type',
      `Set task type for all ${selectedTaskIds.size} selected items:`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '↻ Daily',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await batchRescheduleTasks(Array.from(selectedTaskIds), 'daily');
            setSelectedTaskIds(new Set());
            setIsMultiSelectMode(false);
          },
        },
        {
          text: '⚡ One-Time',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await batchRescheduleTasks(Array.from(selectedTaskIds), 'onetime');
            setSelectedTaskIds(new Set());
            setIsMultiSelectMode(false);
          },
        },
      ]
    );
  }, [selectedTaskIds, batchRescheduleTasks]);

  const handleBatchConfigureAlerts = useCallback(() => {
    setIsBatchAlertsVisible(true);
  }, []);

  const handleBatchDelete = useCallback(async () => {
    if (selectedTaskIds.size === 0) return;
    Alert.alert(
      'Delete Selected Tasks',
      `Are you sure you want to delete all ${selectedTaskIds.size} selected tasks?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            await batchDeleteTasks(Array.from(selectedTaskIds));
            setSelectedTaskIds(new Set());
            setIsMultiSelectMode(false);
          },
        },
      ]
    );
  }, [selectedTaskIds, batchDeleteTasks]);

  const handleCancelSelection = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTaskIds(new Set());
    setIsMultiSelectMode(false);
  }, []);

  // Dummy task for batch alerts configuration
  const batchDummyTask = useMemo(() => {
    return {
      id: 'batch_selection',
      uuid: '',
      title: `${selectedTaskIds.size} Selected Tasks`,
      type: 'daily' as TaskType,
      completed: false,
      completed_date: null,
      created_date: '',
      alerts: [],
    };
  }, [selectedTaskIds.size]);

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

      {/* Real-time Regex Search Bar */}
      <View style={styles.searchBarContainer}>
        <IconSymbol name="magnifyingglass" size={18} color="#9BA1A6" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Filter tasks (Regex supported)..."
          placeholderTextColor="#687076"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchButton}>
            <IconSymbol name="circle" size={16} color="#9BA1A6" />
          </TouchableOpacity>
        )}
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
                isSelected={selectedTaskIds.has(item.uuid)}
                isMultiSelectMode={isMultiSelectMode}
                onSelect={handleSelect}
                onLongPress={handleLongPress}
              />
            )}
            keyExtractor={item => item.id}
            contentContainerStyle={[
              styles.listContent,
              isMultiSelectMode && { paddingBottom: 170 }, // Add bottom padding to prevent FAB overlay overlap
            ]}
          />
        )}
      </View>

      {/* Floating Action Button (FAB) - Hide in multi-select mode */}
      {!isMultiSelectMode && (
        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.8}
          onPress={() => setIsFormVisible(true)}
        >
          <IconSymbol name="plus" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Multi-Select Mass Actions Bar */}
      {isMultiSelectMode && (
        <View style={styles.batchBar}>
          <View style={styles.batchBarHeader}>
            <Text style={styles.batchBarText}>
              {selectedTaskIds.size} {selectedTaskIds.size === 1 ? 'task' : 'tasks'} selected
            </Text>
            <TouchableOpacity onPress={handleCancelSelection} style={styles.cancelBatchButton}>
              <Text style={styles.cancelBatchButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.batchButtonsContainer}>
            <TouchableOpacity onPress={handleBatchToggleComplete} style={styles.batchButton}>
              <IconSymbol name="checkmark.circle.fill" size={14} color="#ECEDEE" />
              <Text style={styles.batchButtonText}>Toggle Status</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleBatchReschedule} style={styles.batchButton}>
              <IconSymbol name="calendar" size={14} color="#ECEDEE" />
              <Text style={styles.batchButtonText}>Change Type</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleBatchConfigureAlerts} style={styles.batchButton}>
              <IconSymbol name="bell.fill" size={14} color="#ECEDEE" />
              <Text style={styles.batchButtonText}>Set Alarms</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleBatchDelete}
              style={[styles.batchButton, styles.batchButtonDestructive]}
            >
              <IconSymbol name="trash.fill" size={14} color="#EF4444" />
              <Text style={[styles.batchButtonText, styles.batchButtonTextDestructive]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

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

      {/* Batch Alerts Scheduler Modal Form */}
      {isBatchAlertsVisible && (
        <BatchAlertForm
          task={batchDummyTask}
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
    paddingBottom: 12,
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
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E20',
    borderColor: '#2C2C2E',
    borderWidth: 1,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 14,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#ECEDEE',
    fontSize: 13,
    fontFamily: Fonts.sans,
    height: '100%',
  },
  clearSearchButton: {
    padding: 4,
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
  batchBar: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#1E1E20',
    borderColor: '#10B981',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'column',
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 999,
  },
  batchBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  batchBarText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: Fonts.rounded,
  },
  cancelBatchButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#2C2C2E',
  },
  cancelBatchButtonText: {
    color: '#ECEDEE',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: Fonts.sans,
  },
  batchButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  batchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#2C2C2E',
    flex: 1,
    minWidth: '45%',
  },
  batchButtonDestructive: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
  },
  batchButtonText: {
    color: '#ECEDEE',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: Fonts.sans,
  },
  batchButtonTextDestructive: {
    color: '#EF4444',
  },
});