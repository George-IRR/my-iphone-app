import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { DataDiff } from '../types';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';

interface DiffModalProps {
  visible: boolean;
  diffs: DataDiff[];
  onAccept: () => void;
  onReject: () => void;
  onClose: () => void;
}

export function DiffModal({
  visible,
  diffs,
  onAccept,
  onReject,
  onClose,
}: DiffModalProps) {
  
  const renderStatusBadge = (status: DataDiff['status']) => {
    switch (status) {
      case 'NEW_IN_MIRROR':
        return <Text style={[styles.badge, styles.badgeNew]}>NEW IN MIRROR</Text>;
      case 'MODIFIED_IN_MIRROR':
        return <Text style={[styles.badge, styles.badgeModified]}>MODIFIED</Text>;
      case 'DELETED_IN_MIRROR':
        return <Text style={[styles.badge, styles.badgeDeleted]}>DELETED IN MIRROR</Text>;
    }
  };

  const renderDiffItem = ({ item }: { item: DataDiff }) => {
    return (
      <View style={styles.diffItemContainer}>
        <View style={styles.diffItemHeader}>
          <Text style={styles.uuidLabel}>UUID: {item.uuid.substring(0, 8)}...</Text>
          {renderStatusBadge(item.status)}
        </View>
        <Text style={styles.diffFields}>Conflict Fields: {item.field}</Text>

        <View style={styles.sideBySideContainer}>
          {/* Left Column - Sandbox State (Red) */}
          <View style={[styles.column, styles.columnLocal]}>
            <Text style={styles.columnHeaderLocal}>Sandbox (Local App)</Text>
            <View style={styles.columnBody}>
              {item.status === 'NEW_IN_MIRROR' ? (
                <Text style={styles.emptyStateText}>No local task entry exists</Text>
              ) : (
                <Text style={styles.taskText}>{item.sandboxValue}</Text>
              )}
            </View>
          </View>

          {/* Right Column - Mirror State (Green) */}
          <View style={[styles.column, styles.columnMirror]}>
            <Text style={styles.columnHeaderMirror}>Mirror (Incoming File)</Text>
            <View style={styles.columnBody}>
              {item.status === 'DELETED_IN_MIRROR' ? (
                <Text style={styles.emptyStateText}>Task deleted / missing</Text>
              ) : (
                <Text style={styles.taskText}>{item.mirrorValue}</Text>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <IconSymbol name="calendar" size={24} color="#F59E0B" />
            <Text style={styles.headerTitle}>Resolve File Parity Conflicts</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.subtext}>
          Differences detected between the local database and the imported CSV. Select a resolution pathway below.
        </Text>

        {/* Conflict FlashList */}
        <View style={styles.listContainer}>
          <FlashList
            data={diffs}
            renderItem={renderDiffItem}
            keyExtractor={item => item.uuid}
            contentContainerStyle={styles.listContent}
          />
        </View>

        {/* Footer Actions */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.buttonReject]}
            activeOpacity={0.8}
            onPress={onReject}
          >
            <Text style={styles.actionButtonText}>Reject / Preserve Local State</Text>
            <Text style={styles.actionButtonSubtext}>Overwrites mirror CSV with local data</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.buttonAccept]}
            activeOpacity={0.8}
            onPress={onAccept}
          >
            <Text style={styles.actionButtonText}>Accept Mirror Modifications</Text>
            <Text style={styles.actionButtonSubtext}>Overwrites local database with mirror</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#151718',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#2C2C2E',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ECEDEE',
    fontFamily: Fonts.rounded,
  },
  closeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#2C2C2E',
  },
  closeButtonText: {
    fontSize: 12,
    color: '#ECEDEE',
    fontWeight: '600',
  },
  subtext: {
    fontSize: 12,
    color: '#9BA1A6',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    lineHeight: 18,
    fontFamily: Fonts.sans,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  diffItemContainer: {
    backgroundColor: '#1E1E20',
    borderRadius: 14,
    borderColor: '#2C2C2E',
    borderWidth: 1,
    padding: 12,
    marginTop: 12,
  },
  diffItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  uuidLabel: {
    fontSize: 11,
    fontFamily: Fonts.mono,
    color: '#687076',
  },
  badge: {
    fontSize: 9,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: Fonts.mono,
  },
  badgeNew: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    color: '#34D399',
  },
  badgeModified: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    color: '#F59E0B',
  },
  badgeDeleted: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: '#EF4444',
  },
  diffFields: {
    fontSize: 11,
    color: '#F59E0B',
    marginBottom: 10,
    fontFamily: Fonts.sans,
  },
  sideBySideContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  column: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  columnLocal: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  columnMirror: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  columnHeaderLocal: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#EF4444',
    fontFamily: Fonts.sans,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  columnHeaderMirror: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#10B981',
    fontFamily: Fonts.sans,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  columnBody: {
    minHeight: 45,
  },
  emptyStateText: {
    fontSize: 11,
    color: '#687076',
    fontStyle: 'italic',
    fontFamily: Fonts.sans,
  },
  taskText: {
    fontSize: 12,
    color: '#ECEDEE',
    fontFamily: Fonts.sans,
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderColor: '#2C2C2E',
    backgroundColor: '#1E1E20',
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonReject: {
    backgroundColor: '#EF4444',
  },
  buttonAccept: {
    backgroundColor: '#10B981',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: Fonts.sans,
  },
  actionButtonSubtext: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    textAlign: 'center',
    fontFamily: Fonts.sans,
  },
});
