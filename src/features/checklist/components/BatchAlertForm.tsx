import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Task } from '../types';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useNotificationEngine } from '../hooks/useNotificationEngine';
import { Fonts } from '@/constants/theme';

interface BatchAlertFormProps {
  task: Task | null;
  onClose: () => void;
  onSaveAlerts: (taskId: string, alerts: string[]) => void;
}

export function BatchAlertForm({ task, onClose, onSaveAlerts }: BatchAlertFormProps) {
  const { createDailyAlarmAlerts, createOffsetIntervalAlerts } = useNotificationEngine();
  
  const [activeTab, setActiveTab] = useState<'individual' | 'batch-slots' | 'batch-interval'>('individual');
  const [tempAlerts, setTempAlerts] = useState<string[]>([]);
  
  // Single alert inputs
  const [hour, setHour] = useState('08');
  const [minute, setMinute] = useState('00');
  
  // Batch Slot inputs
  const [slotText, setSlotText] = useState('08:00, 12:00, 16:00, 20:00');
  
  // Batch Interval inputs
  const [intervalHrs, setIntervalHrs] = useState('3');
  const [occurrenceCount, setOccurrenceCount] = useState('4');

  // Load task's existing alerts
  useEffect(() => {
    if (task) {
      setTempAlerts(task.alerts);
    }
  }, [task]);

  if (!task) return null;

  const handleAddSingleTime = () => {
    const hr = parseInt(hour, 10);
    const min = parseInt(minute, 10);
    
    if (isNaN(hr) || hr < 0 || hr >= 24 || isNaN(min) || min < 0 || min >= 60) {
      Alert.alert('Invalid Time', 'Please enter a valid hour (0-23) and minute (0-59)');
      return;
    }
    
    const timeStr = `time:${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    
    if (tempAlerts.includes(timeStr)) {
      Alert.alert('Duplicate Alert', 'This alert is already scheduled.');
      return;
    }
    
    setTempAlerts([...tempAlerts, timeStr]);
  };

  const handleApplyBatchSlots = () => {
    // Splits comma separated HH:MM times
    const times = slotText
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);
      
    const formatted = createDailyAlarmAlerts(times);
    
    if (formatted.length === 0) {
      Alert.alert('Format Error', 'Could not parse any valid times. Use HH:MM format (e.g. 08:30, 12:00)');
      return;
    }
    
    // Merge unique alerts
    const merged = Array.from(new Set([...tempAlerts, ...formatted]));
    setTempAlerts(merged);
  };

  const handleApplyBatchIntervals = () => {
    const hrs = parseFloat(intervalHrs);
    const count = parseInt(occurrenceCount, 10);
    
    if (isNaN(hrs) || hrs <= 0 || isNaN(count) || count <= 0) {
      Alert.alert('Invalid Parameters', 'Interval hours and count must be positive numbers.');
      return;
    }
    
    if (count > 20) {
      Alert.alert('Limit Exceeded', 'You can batch schedule a maximum of 20 notifications at once.');
      return;
    }
    
    const formatted = createOffsetIntervalAlerts(hrs, count);
    const merged = Array.from(new Set([...tempAlerts, ...formatted]));
    setTempAlerts(merged);
  };

  const handleRemoveAlert = (indexToRemove: number) => {
    setTempAlerts(tempAlerts.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSave = () => {
    onSaveAlerts(task.id, tempAlerts);
    onClose();
  };

  const handleClearAll = () => {
    setTempAlerts([]);
  };

  const renderAlertText = (alertStr: string) => {
    if (alertStr.startsWith('time:')) {
      return `Daily at ${alertStr.substring(5)}`;
    } else if (alertStr.startsWith('datetime:')) {
      const date = new Date(alertStr.substring(9));
      return date.toLocaleString();
    } else if (alertStr.startsWith('offset:')) {
      const sec = parseInt(alertStr.substring(7), 10);
      return `Interval Delay: ${sec / 3600} hours`;
    }
    return alertStr;
  };

  return (
    <Modal
      visible={true}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContent}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <IconSymbol name="bell.fill" size={22} color="#F59E0B" />
              <Text style={styles.headerTitle}>Configure Task Alerts</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.taskTitleLabel}>Task: &quot;{task.title}&quot;</Text>

          {/* Alert Type Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'individual' && styles.tabButtonActive]}
              onPress={() => setActiveTab('individual')}
            >
              <Text style={[styles.tabText, activeTab === 'individual' && styles.tabTextActive]}>
                Single Daily
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'batch-slots' && styles.tabButtonActive]}
              onPress={() => setActiveTab('batch-slots')}
            >
              <Text style={[styles.tabText, activeTab === 'batch-slots' && styles.tabTextActive]}>
                Daily Slots
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'batch-interval' && styles.tabButtonActive]}
              onPress={() => setActiveTab('batch-interval')}
            >
              <Text style={[styles.tabText, activeTab === 'batch-interval' && styles.tabTextActive]}>
                Offsets
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Contents */}
          <View style={styles.formSection}>
            {activeTab === 'individual' && (
              <View>
                <Text style={styles.label}>Set Daily Alarm Time</Text>
                <View style={styles.timeInputRow}>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Hour (00-23)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={hour}
                      onChangeText={setHour}
                      placeholder="08"
                      keyboardType="numeric"
                      maxLength={2}
                    />
                  </View>
                  <Text style={styles.timeColon}>:</Text>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Minute (00-59)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={minute}
                      onChangeText={setMinute}
                      placeholder="00"
                      keyboardType="numeric"
                      maxLength={2}
                    />
                  </View>
                  
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={handleAddSingleTime}
                  >
                    <Text style={styles.addButtonText}>+ Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {activeTab === 'batch-slots' && (
              <View>
                <Text style={styles.label}>Enter Comma-Separated Times (24h format)</Text>
                <TextInput
                  style={styles.textAreaInput}
                  value={slotText}
                  onChangeText={setSlotText}
                  placeholder="08:00, 12:00, 16:00"
                  multiline={true}
                />
                <TouchableOpacity
                  style={styles.batchApplyButton}
                  onPress={handleApplyBatchSlots}
                >
                  <Text style={styles.batchApplyButtonText}>Batch Apply Alarm Slots</Text>
                </TouchableOpacity>
              </View>
            )}

            {activeTab === 'batch-interval' && (
              <View>
                <Text style={styles.label}>Batch Schedule Multi-Hour Delay Intervals</Text>
                
                <View style={styles.intervalInputsRow}>
                  <View style={styles.flexInput}>
                    <Text style={styles.inputLabel}>Interval (Hours)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={intervalHrs}
                      onChangeText={setIntervalHrs}
                      placeholder="3"
                      keyboardType="numeric"
                    />
                  </View>
                  
                  <View style={styles.flexInput}>
                    <Text style={styles.inputLabel}>Count (Occurrences)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={occurrenceCount}
                      onChangeText={setOccurrenceCount}
                      placeholder="4"
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                
                <TouchableOpacity
                  style={[styles.batchApplyButton, styles.intervalApplyButton]}
                  onPress={handleApplyBatchIntervals}
                >
                  <Text style={styles.batchApplyButtonText}>Generate Alarm Offsets</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Configured Alerts List */}
          <Text style={styles.listHeader}>
            Active Schedules ({tempAlerts.length})
          </Text>
          
          <ScrollView style={styles.alertsList} contentContainerStyle={styles.alertsListContent}>
            {tempAlerts.length === 0 ? (
              <Text style={styles.emptyAlertsText}>No alarms configured for this task.</Text>
            ) : (
              tempAlerts.map((alert, idx) => (
                <View key={idx} style={styles.alertRow}>
                  <View style={styles.alertDetailRow}>
                    <IconSymbol name="clock.fill" size={14} color="#10B981" />
                    <Text style={styles.alertRowText}>{renderAlertText(alert)}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveAlert(idx)}
                    style={styles.removeAlertButton}
                  >
                    <Text style={styles.removeAlertText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>

          {/* Footer Save & Control Actions */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.clearAllButton}
              onPress={handleClearAll}
            >
              <Text style={styles.clearAllText}>Clear All</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
            >
              <Text style={styles.saveButtonText}>Save & Apply</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#151718',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderColor: '#2C2C2E',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ECEDEE',
    fontFamily: Fonts.rounded,
  },
  closeButton: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: '#2C2C2E',
  },
  closeButtonText: {
    fontSize: 14,
    color: '#ECEDEE',
    fontWeight: 'bold',
  },
  taskTitleLabel: {
    fontSize: 14,
    color: '#9BA1A6',
    fontStyle: 'italic',
    paddingHorizontal: 20,
    paddingTop: 14,
    fontFamily: Fonts.sans,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 14,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#1E1E20',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
  },
  tabText: {
    fontSize: 12,
    color: '#9BA1A6',
    fontWeight: '600',
    fontFamily: Fonts.sans,
  },
  tabTextActive: {
    color: '#10B981',
  },
  formSection: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ECEDEE',
    marginBottom: 8,
    fontFamily: Fonts.sans,
  },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  inputContainer: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 10,
    color: '#9BA1A6',
    marginBottom: 4,
    fontFamily: Fonts.mono,
  },
  textInput: {
    backgroundColor: '#1E1E20',
    borderColor: '#2C2C2E',
    borderWidth: 1,
    borderRadius: 8,
    color: '#ECEDEE',
    padding: 10,
    textAlign: 'center',
    fontSize: 16,
    fontFamily: Fonts.mono,
  },
  timeColon: {
    color: '#ECEDEE',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  addButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
    fontFamily: Fonts.sans,
  },
  textAreaInput: {
    backgroundColor: '#1E1E20',
    borderColor: '#2C2C2E',
    borderWidth: 1,
    borderRadius: 8,
    color: '#ECEDEE',
    padding: 12,
    minHeight: 60,
    fontSize: 14,
    fontFamily: Fonts.mono,
    textAlignVertical: 'top',
  },
  batchApplyButton: {
    backgroundColor: '#4F46E5',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  batchApplyButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
    fontFamily: Fonts.sans,
  },
  intervalInputsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  flexInput: {
    flex: 1,
  },
  intervalApplyButton: {
    backgroundColor: '#D97706',
  },
  listHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ECEDEE',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 6,
    fontFamily: Fonts.rounded,
  },
  alertsList: {
    flex: 1,
    maxHeight: 180,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    borderRadius: 8,
    marginHorizontal: 20,
    backgroundColor: '#1E1E20',
  },
  alertsListContent: {
    padding: 8,
  },
  emptyAlertsText: {
    color: '#687076',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 10,
    fontFamily: Fonts.sans,
  },
  alertRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderColor: '#2C2C2E',
  },
  alertDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertRowText: {
    color: '#ECEDEE',
    fontSize: 13,
    fontFamily: Fonts.mono,
  },
  removeAlertButton: {
    padding: 4,
  },
  removeAlertText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  clearAllButton: {
    flex: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#EF4444',
    borderWidth: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  clearAllText: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 14,
    fontFamily: Fonts.sans,
  },
  saveButton: {
    flex: 2,
    backgroundColor: '#10B981',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
    fontFamily: Fonts.sans,
  },
});
