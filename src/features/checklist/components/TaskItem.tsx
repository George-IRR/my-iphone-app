import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Task } from '../types';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onConfigureAlerts: (task: Task) => void;
}

export const TaskItem = React.memo(function TaskItem({
  task,
  onToggle,
  onDelete,
  onConfigureAlerts,
}: TaskItemProps) {
  const handleToggle = React.useCallback(() => {
    onToggle(task.id);
  }, [task.id, onToggle]);

  const handleDelete = React.useCallback(() => {
    onDelete(task.id);
  }, [task.id, onDelete]);

  const handleConfigureAlerts = React.useCallback(() => {
    onConfigureAlerts(task);
  }, [task, onConfigureAlerts]);

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

  return (
    <View style={[styles.container, task.completed && styles.containerCompleted]}>
      {/* Complete Checkbox button */}
      <TouchableOpacity
        onPress={handleToggle}
        activeOpacity={0.7}
        style={styles.checkboxContainer}
      >
        <IconSymbol
          name={task.completed ? 'checkmark.circle.fill' : 'circle'}
          size={26}
          color={task.completed ? '#10B981' : '#9BA1A6'}
        />
      </TouchableOpacity>

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

      {/* Options Panel */}
      <View style={styles.actionsContainer}>
        {/* Set alarms button */}
        <TouchableOpacity
          onPress={handleConfigureAlerts}
          activeOpacity={0.6}
          style={styles.actionButton}
        >
          <IconSymbol
            name="bell.fill"
            size={18}
            color={task.alerts.length > 0 ? '#F59E0B' : '#9BA1A6'}
          />
        </TouchableOpacity>

        {/* Delete button */}
        <TouchableOpacity
          onPress={handleDelete}
          activeOpacity={0.6}
          style={styles.actionButton}
        >
          <IconSymbol name="trash.fill" size={18} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
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
    borderColor: 'rgba(16, 185, 129, 0.3)',
    backgroundColor: '#161C19',
  },
  checkboxContainer: {
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
    backgroundColor: 'rgba(79, 70, 229, 0.2)',
    borderColor: 'rgba(79, 70, 229, 0.4)',
    borderWidth: 1,
  },
  badgeOneTime: {
    backgroundColor: 'rgba(104, 112, 118, 0.2)',
    borderColor: 'rgba(104, 112, 118, 0.4)',
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ECEDEE',
    fontFamily: Fonts.mono,
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
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 6,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#2C2C2E',
  },
});
