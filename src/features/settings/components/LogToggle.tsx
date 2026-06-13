import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';

interface LogToggleProps {
  isEnabled: boolean;
  onToggle: (val: boolean) => void;
  onReadLogs: () => Promise<string>;
  onClearLogs: () => Promise<void>;
}

export function LogToggle({
  isEnabled,
  onToggle,
  onReadLogs,
  onClearLogs,
}: LogToggleProps) {
  const [logText, setLogText] = useState('');
  const [showPane, setShowPane] = useState(false);

  const handleFetchLogs = async () => {
    if (showPane) {
      setShowPane(false);
      return;
    }
    const text = await onReadLogs();
    setLogText(text || 'No log entries found. Start synchronizing files to see logs.');
    setShowPane(true);
  };

  const handleClear = async () => {
    await onClearLogs();
    setLogText('Trace log cleared.');
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.labelContainer}>
          <IconSymbol name="bell.fill" size={20} color="#10B981" />
          <View>
            <Text style={styles.title}>Verbose Debug Logging</Text>
            <Text style={styles.subtitle}>Trace operational file modifications</Text>
          </View>
        </View>
        <Switch
          trackColor={{ false: '#3E3F40', true: '#10B981' }}
          thumbColor={isEnabled ? '#FFFFFF' : '#ECEDEE'}
          ios_backgroundColor="#3E3F40"
          onValueChange={onToggle}
          value={isEnabled}
        />
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          onPress={handleFetchLogs}
          activeOpacity={0.8}
          style={[styles.button, showPane && styles.buttonActive]}
        >
          <Text style={styles.buttonText}>
            {showPane ? 'Hide Trace Logs' : 'View Trace Logs'}
          </Text>
        </TouchableOpacity>

        {showPane && (
          <TouchableOpacity
            onPress={handleClear}
            activeOpacity={0.8}
            style={[styles.button, styles.clearButton]}
          >
            <Text style={styles.buttonText}>Clear Logs</Text>
          </TouchableOpacity>
        )}
      </View>

      {showPane && (
        <View style={styles.terminalContainer}>
          <ScrollView style={styles.terminalScroll} nestedScrollEnabled={true}>
            <Text style={styles.terminalText}>{logText}</Text>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E1E20',
    borderColor: '#2C2C2E',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ECEDEE',
    fontFamily: Fonts.rounded,
  },
  subtitle: {
    fontSize: 12,
    color: '#9BA1A6',
    marginTop: 2,
    fontFamily: Fonts.sans,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 8,
  },
  button: {
    backgroundColor: '#2C2C2E',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  buttonActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
    borderWidth: 0.5,
  },
  clearButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
    borderWidth: 0.5,
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ECEDEE',
    fontFamily: Fonts.sans,
  },
  terminalContainer: {
    backgroundColor: '#0F0F10',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    padding: 12,
    marginTop: 12,
  },
  terminalScroll: {
    maxHeight: 180,
  },
  terminalText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: '#34D399',
    lineHeight: 16,
  },
});
