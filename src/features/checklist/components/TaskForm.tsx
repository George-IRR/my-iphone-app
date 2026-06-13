import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { TaskType } from '../types';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';

interface TaskFormProps {
  visible: boolean;
  onClose: () => void;
  onSave: (title: string, type: TaskType) => void;
}

export function TaskForm({ visible, onClose, onSave }: TaskFormProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<TaskType>('daily');

  const handleSave = () => {
    if (title.trim() === '') {
      return;
    }
    onSave(title, type);
    setTitle('');
    setType('daily');
    onClose();
  };

  return (
    <Modal
      visible={visible}
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
            <Text style={styles.headerTitle}>Add New Task</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View style={styles.form}>
            {/* Title Input */}
            <Text style={styles.label}>Task Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Morning meditation, Drink water..."
              placeholderTextColor="#687076"
              autoFocus={true}
            />

            {/* Type Selector (Daily vs One-Time) */}
            <Text style={styles.label}>Task Schedule Mode</Text>
            <View style={styles.typeSelectorRow}>
              {/* Daily Button */}
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  type === 'daily' && styles.typeButtonActive,
                ]}
                onPress={() => setType('daily')}
              >
                <IconSymbol
                  name="calendar"
                  size={18}
                  color={type === 'daily' ? '#10B981' : '#9BA1A6'}
                />
                <Text
                  style={[
                    styles.typeButtonText,
                    type === 'daily' && styles.typeButtonTextActive,
                  ]}
                >
                  Daily Recurrence
                </Text>
              </TouchableOpacity>

              {/* One-Time Button */}
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  type === 'onetime' && styles.typeButtonActive,
                ]}
                onPress={() => setType('onetime')}
              >
                <IconSymbol
                  name="paperplane.fill"
                  size={16}
                  color={type === 'onetime' ? '#10B981' : '#9BA1A6'}
                />
                <Text
                  style={[
                    styles.typeButtonText,
                    type === 'onetime' && styles.typeButtonTextActive,
                  ]}
                >
                  One-Time Task
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer Save Button */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Create Checklist Task</Text>
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
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: '#2C2C2E',
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
  form: {
    marginTop: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ECEDEE',
    marginBottom: 8,
    fontFamily: Fonts.sans,
  },
  input: {
    backgroundColor: '#1E1E20',
    borderColor: '#2C2C2E',
    borderWidth: 1,
    borderRadius: 12,
    color: '#ECEDEE',
    padding: 14,
    fontSize: 15,
    marginBottom: 20,
    fontFamily: Fonts.sans,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E1E20',
    borderColor: '#2C2C2E',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
  },
  typeButtonActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
  },
  typeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9BA1A6',
    fontFamily: Fonts.sans,
  },
  typeButtonTextActive: {
    color: '#10B981',
  },
  footer: {
    marginTop: 10,
  },
  saveButton: {
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
    fontFamily: Fonts.sans,
  },
});
