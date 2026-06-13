import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSyncEngine } from '../hooks/useSyncEngine';
import { LogToggle } from './LogToggle';
import { DiffModal } from './DiffModal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';
import {
  rotateAndCreateBackup,
  listBackups,
  restoreFromBackup,
  writeTraceLog,
} from '../../../services/csvStorage';

export function SettingsView() {
  const [backupsList, setBackupsList] = useState<{ filename: string; timestamp: string; size: number }[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [isDiffModalVisible, setIsDiffModalVisible] = useState(false);

  // Sync Completion trigger
  const handleSyncComplete = useCallback(() => {
    Alert.alert('Sync Successful', 'Parity established. Sandbox and external targets have reconciled.');
    fetchBackups();
  }, []);

  const {
    state,
    externalUri,
    diffs,
    permanentMirrorUri,
    toggleVerboseLogging,
    scanExternalFile,
    acceptMirrorModifications,
    rejectMirrorModifications,
    linkPermanentMirror,
    unlinkPermanentMirror,
    clearLogs,
    readLogs,
  } = useSyncEngine(handleSyncComplete);

  // Fetch Backups list
  const fetchBackups = async () => {
    try {
      setBackupsLoading(true);
      const list = await listBackups();
      setBackupsList(list);
    } catch (err) {
      console.error('Failed to load backups:', err);
    } finally {
      setBackupsLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleScanFile = async () => {
    const calculatedDiffs = await scanExternalFile();
    if (calculatedDiffs !== null) {
      if (calculatedDiffs.length === 0) {
        Alert.alert('Parity Confirmed', 'Sandbox and mirror are already in sync. No differences found.');
      } else {
        setIsDiffModalVisible(true);
      }
    }
  };

  const handleCreateBackup = async () => {
    try {
      setBackupsLoading(true);
      await rotateAndCreateBackup();
      await fetchBackups();
      Alert.alert('Backup Created', 'A new rolling backup snapshot (backup_1.csv) has been successfully generated.');
    } catch {
      Alert.alert('Backup Error', 'Failed to generate backup snapshot.');
    } finally {
      setBackupsLoading(false);
    }
  };

  const handleRestoreBackup = (filename: string) => {
    Alert.alert(
      'Restore Database',
      `Are you sure you want to overwrite your active tasks database with snapshot "${filename}"? All current modifications will be replaced.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            try {
              setBackupsLoading(true);
              await restoreFromBackup(filename);
              Alert.alert('Restore Complete', 'Active tasks database has been restored from snapshot.');
              await writeTraceLog(`[BACKUP] Manually restored snapshot ${filename}`);
            } catch {
              Alert.alert('Error', 'Failed to restore database from backup.');
            } finally {
              setBackupsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleAcceptSync = async () => {
    setIsDiffModalVisible(false);
    await acceptMirrorModifications();
  };

  const handleRejectSync = async () => {
    setIsDiffModalVisible(false);
    await rejectMirrorModifications();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.sectionHeader}>Data Synchronizations</Text>

      {/* Sync Card */}
      <View style={styles.card}>
        <View style={styles.syncStatusRow}>
          <View style={styles.statusLabelRow}>
            <IconSymbol name="paperplane.fill" size={20} color="#10B981" />
            <Text style={styles.cardTitle}>Manual CSV File Import</Text>
          </View>
          <Text style={styles.syncStatusLabel}>
            {externalUri ? 'Linked' : 'Not Linked'}
          </Text>
        </View>

        <View style={styles.syncDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailName}>Last Synced:</Text>
            <Text style={styles.detailVal}>{state.lastSyncDate || 'Never'}</Text>
          </View>
          {externalUri && (
            <View style={styles.detailRow}>
              <Text style={styles.detailName}>Source URI:</Text>
              <Text style={styles.detailVal} numberOfLines={1} ellipsizeMode="middle">
                {externalUri}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.scanButton}
          activeOpacity={0.8}
          onPress={handleScanFile}
          disabled={state.loading}
        >
          {state.loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <IconSymbol name="plus" size={16} color="#FFFFFF" />
              <Text style={styles.scanButtonText}>Import & Reconcile CSV File</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Permanent Mirror Sync Card */}
      <View style={styles.card}>
        <View style={styles.syncStatusRow}>
          <View style={styles.statusLabelRow}>
            <IconSymbol name="gearshape" size={20} color="#F59E0B" />
            <Text style={styles.cardTitle}>Permanent Export Mirror</Text>
          </View>
          <Text style={[styles.syncStatusLabel, !permanentMirrorUri && { color: '#9BA1A6', backgroundColor: '#2C2C2E' }]}>
            {permanentMirrorUri ? 'Linked' : 'Not Linked'}
          </Text>
        </View>

        <Text style={[styles.cardSubtitle, { marginBottom: 12, lineHeight: 16 }]}>
          Auto-updates a selected external file in your iOS Files browser instantly whenever you make database mutations (add, toggle, or delete tasks).
        </Text>

        <View style={styles.syncDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailName}>Mirror Target File:</Text>
            <Text style={styles.detailVal} numberOfLines={1} ellipsizeMode="middle">
              {permanentMirrorUri ? permanentMirrorUri : 'None Linked'}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={[styles.scanButton, { backgroundColor: '#F59E0B', flex: 1 }]}
            activeOpacity={0.8}
            onPress={linkPermanentMirror}
            disabled={state.loading}
          >
            <IconSymbol name="plus" size={16} color="#FFFFFF" />
            <Text style={styles.scanButtonText}>
              {permanentMirrorUri ? 'Re-link / Change File' : 'Link Permanent Export File'}
            </Text>
          </TouchableOpacity>

          {permanentMirrorUri && (
            <TouchableOpacity
              style={[styles.scanButton, { backgroundColor: '#EF4444', paddingHorizontal: 16 }]}
              activeOpacity={0.8}
              onPress={unlinkPermanentMirror}
              disabled={state.loading}
            >
              <Text style={styles.scanButtonText}>Unlink</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Backups Card */}
      <Text style={styles.sectionHeader}>Rolling Backups (Option C)</Text>
      
      <View style={styles.card}>
        <View style={styles.backupHeader}>
          <View>
            <Text style={styles.cardTitle}>Database Snapshot Backups</Text>
            <Text style={styles.cardSubtitle}>Maintains a rolling queue of 5 milestones</Text>
          </View>
          
          <TouchableOpacity
            style={styles.createBackupButton}
            onPress={handleCreateBackup}
            disabled={backupsLoading}
          >
            <Text style={styles.createBackupText}>+ Create</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.backupsList}>
          {backupsLoading && backupsList.length === 0 ? (
            <ActivityIndicator size="small" color="#10B981" style={{ marginVertical: 10 }} />
          ) : backupsList.length === 0 ? (
            <Text style={styles.emptyBackupsText}>No backup snapshots created yet.</Text>
          ) : (
            backupsList.map((backup, index) => (
              <TouchableOpacity
                key={index}
                style={styles.backupItem}
                activeOpacity={0.7}
                onPress={() => handleRestoreBackup(backup.filename)}
              >
                <View style={styles.backupItemMain}>
                  <IconSymbol name="calendar" size={16} color="#9BA1A6" />
                  <View>
                    <Text style={styles.backupName}>{backup.filename}</Text>
                    <Text style={styles.backupTime}>{backup.timestamp}</Text>
                  </View>
                </View>
                <Text style={styles.backupSize}>{Math.round(backup.size / 10.24) / 100} KB</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>

      {/* Logs section */}
      <Text style={styles.sectionHeader}>Diagnostics</Text>
      <LogToggle
        isEnabled={state.isVerboseLogging}
        onToggle={toggleVerboseLogging}
        onReadLogs={readLogs}
        onClearLogs={clearLogs}
      />

      {/* Diff Resolution Modal overlay */}
      {isDiffModalVisible && (
        <DiffModal
          visible={isDiffModalVisible}
          diffs={diffs}
          onAccept={handleAcceptSync}
          onReject={handleRejectSync}
          onClose={() => setIsDiffModalVisible(false)}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#151718',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#687076',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 16,
    fontFamily: Fonts.mono,
  },
  card: {
    backgroundColor: '#1E1E20',
    borderColor: '#2C2C2E',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  syncStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  statusLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ECEDEE',
    fontFamily: Fonts.rounded,
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#9BA1A6',
    marginTop: 2,
    fontFamily: Fonts.sans,
  },
  syncStatusLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    fontFamily: Fonts.mono,
  },
  syncDetails: {
    backgroundColor: '#151718',
    borderColor: '#2C2C2E',
    borderWidth: 0.5,
    borderRadius: 10,
    padding: 12,
    gap: 8,
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailName: {
    fontSize: 12,
    color: '#9BA1A6',
    fontFamily: Fonts.sans,
  },
  detailVal: {
    fontSize: 12,
    color: '#ECEDEE',
    fontFamily: Fonts.mono,
    maxWidth: '65%',
  },
  scanButton: {
    backgroundColor: '#4F46E5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
  },
  scanButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
    fontFamily: Fonts.sans,
  },
  backupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  createBackupButton: {
    backgroundColor: '#10B981',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  createBackupText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: Fonts.sans,
  },
  backupsList: {
    gap: 8,
  },
  emptyBackupsText: {
    fontSize: 12,
    color: '#687076',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 10,
    fontFamily: Fonts.sans,
  },
  backupItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#151718',
    borderColor: '#2C2C2E',
    borderWidth: 0.5,
    borderRadius: 10,
    padding: 10,
  },
  backupItemMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backupName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ECEDEE',
    fontFamily: Fonts.rounded,
  },
  backupTime: {
    fontSize: 10,
    color: '#687076',
    marginTop: 2,
    fontFamily: Fonts.sans,
  },
  backupSize: {
    fontSize: 11,
    color: '#9BA1A6',
    fontFamily: Fonts.mono,
  },
});
