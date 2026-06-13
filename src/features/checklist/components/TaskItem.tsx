import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import ReanimatedSwipeable, {
  SwipeableMethods,
  SwipeDirection,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Task } from '../types';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onConfigureAlerts: (task: Task) => void;
  isSelected?: boolean;
  isMultiSelectMode?: boolean;
  onSelect?: (id: string) => void;
  onLongPress?: (id: string) => void;
}

export const TaskItem = React.memo(function TaskItem({
  task,
  onToggle,
  onDelete,
  onConfigureAlerts,
  isSelected = false,
  isMultiSelectMode = false,
  onSelect,
  onLongPress,
}: TaskItemProps) {
  const swipeableRef = React.useRef<SwipeableMethods>(null);

  const handleToggle = React.useCallback(() => {
    onToggle(task.uuid);
  }, [task.uuid, onToggle]);

  const handleDelete = React.useCallback(() => {
    onDelete(task.uuid);
  }, [task.uuid, onDelete]);

  const handleConfigureAlerts = React.useCallback(() => {
    onConfigureAlerts(task);
  }, [task, onConfigureAlerts]);

  const handlePress = React.useCallback(() => {
    if (isMultiSelectMode && onSelect) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSelect(task.uuid);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      handleToggle();
    }
  }, [isMultiSelectMode, onSelect, task.uuid, handleToggle]);

  const handleLongPress = React.useCallback(() => {
    if (onLongPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onLongPress(task.uuid);
    }
  }, [onLongPress, task.uuid]);

  // Clean description of scheduled alerts
  const formatAlertText = (alertStr: string) => {
    if (alertStr.startsWith('time:')) {
      return `Daily @ ${alertStr.substring(5)}`;
    } else if (alertStr.startsWith('datetime:')) {
      const date = new Date(alertStr.substring(9));
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } else if (alertStr.startsWith('offset:')) {
      const seconds = parseInt(alertStr.substring(7), 10);
      const hours = seconds / 3600;
      return `Delay: ${hours}h`;
    }
    return alertStr;
  };

  const handleSwipeOpen = (direction: SwipeDirection.LEFT | SwipeDirection.RIGHT) => {
    if (direction === SwipeDirection.RIGHT) {
      // Swiped left-to-right (revealing left actions, e.g. checkmark) -> toggle complete
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      handleToggle();
      swipeableRef.current?.close();
    } else if (direction === SwipeDirection.LEFT) {
      // Swiped right-to-left (revealing right actions, e.g. trash) -> delete
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      handleDelete();
      swipeableRef.current?.close();
    }
  };

  const renderLeftActions = (
    _progress: SharedValue<number>,
    _translation: SharedValue<number>,
    _swipeable: SwipeableMethods
  ) => {
    return (
      <View style={[styles.swipeActionContainer, styles.swipeLeftAction]}>
        <IconSymbol name="checkmark.circle.fill" size={22} color="#FFFFFF" />
        <Text style={styles.swipeActionText}>Complete</Text>
      </View>
    );
  };

  const renderRightActions = (
    _progress: SharedValue<number>,
    _translation: SharedValue<number>,
    _swipeable: SwipeableMethods
  ) => {
    return (
      <View style={[styles.swipeActionContainer, styles.swipeRightAction]}>
        <Text style={styles.swipeActionText}>Delete</Text>
        <IconSymbol name="trash.fill" size={22} color="#FFFFFF" />
      </View>
    );
  };

  const content = (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.85}
      style={[
        styles.container,
        task.completed && styles.containerCompleted,
        isSelected && styles.containerSelected,
      ]}
    >
      {/* Selection indicator when in multi-select mode */}
      {isMultiSelectMode && (
        <View style={styles.selectionIndicator}>
          <IconSymbol
            name={isSelected ? 'checkmark.circle.fill' : 'circle'}
            size={22}
            color={isSelected ? '#10B981' : '#9BA1A6'}
          />
        </View>
      )}

      {/* Task Details Info */}
      <View style={styles.detailsContainer}>
        <Text style={[styles.title, task.completed && styles.titleCompleted]}>
          {task.title}
        </Text>
        
        <View style={styles.metaRow}>
          {/* Recurrence Type Badge */}
          <View
            style={[
              styles.badge,
              task.type === 'daily' ? styles.badgeDaily : styles.badgeOneTime,
            ]}
          >
            <Text style={styles.badgeText}>
              {task.type === 'daily' ? '↻ Daily' : '⚡ One-Time'}
            </Text>
          </View>

          {/* Alarm Config Button */}
          {!isMultiSelectMode && (
            <TouchableOpacity
              onPress={handleConfigureAlerts}
              activeOpacity={0.6}
              style={styles.bellButton}
            >
              <IconSymbol
                name="bell.fill"
                size={12}
                color={task.alerts.length > 0 ? '#F59E0B' : '#9BA1A6'}
              />
            </TouchableOpacity>
          )}

          {/* Completion Date Label */}
          {task.completed && task.completed_date && (
            <Text style={styles.completedDateText}>
              Done: {new Date(task.completed_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </View>

        {/* Display Active Alerts */}
        {task.alerts.length > 0 && (
          <View style={styles.alertsContainer}>
            <IconSymbol name="clock.fill" size={12} color="#9BA1A6" />
            <Text style={styles.alertsTitle}>Alerts:</Text>
            <View style={styles.alertTagsList}>
              {task.alerts.map((alert, index) => (
                <View key={index} style={styles.alertTag}>
                  <Text style={styles.alertTagText}>{formatAlertText(alert)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      enabled={!isMultiSelectMode}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableWillOpen={handleSwipeOpen}
      leftThreshold={60}
      rightThreshold={60}
    >
      {content}
    </ReanimatedSwipeable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E20',
    borderColor: '#2C2C2E',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  containerCompleted: {
    borderColor: 'rgba(16, 185, 129, 0.2)',
    backgroundColor: '#161C19',
  },
  containerSelected: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  selectionIndicator: {
    marginRight: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ECEDEE',
    fontFamily: Fonts.rounded,
    lineHeight: 20,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: '#687076',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  badgeDaily: {
    backgroundColor: 'rgba(79, 70, 229, 0.15)',
    borderColor: 'rgba(79, 70, 229, 0.3)',
    borderWidth: 1,
  },
  badgeOneTime: {
    backgroundColor: 'rgba(104, 112, 118, 0.15)',
    borderColor: 'rgba(104, 112, 118, 0.3)',
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ECEDEE',
    fontFamily: Fonts.mono,
  },
  bellButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedDateText: {
    fontSize: 11,
    color: '#10B981',
    fontFamily: Fonts.sans,
  },
  alertsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 4,
  },
  alertsTitle: {
    fontSize: 11,
    color: '#9BA1A6',
    fontWeight: '500',
    fontFamily: Fonts.sans,
  },
  alertTagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  alertTag: {
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#3E3F40',
  },
  alertTagText: {
    fontSize: 10,
    color: '#ECEDEE',
    fontFamily: Fonts.mono,
  },
  swipeActionContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  swipeLeftAction: {
    backgroundColor: '#10B981',
    justifyContent: 'flex-start',
    gap: 8,
  },
  swipeRightAction: {
    backgroundColor: '#EF4444',
    justifyContent: 'flex-end',
    gap: 8,
  },
  swipeActionText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
    fontFamily: Fonts.sans,
  },
});
