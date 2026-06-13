export interface DataDiff {
  uuid: string;
  field: string;
  sandboxValue: string;
  mirrorValue: string;
  status: 'NEW_IN_MIRROR' | 'MODIFIED_IN_MIRROR' | 'DELETED_IN_MIRROR';
}

export interface SyncEngineState {
  isVerboseLogging: boolean;
  lastSyncDate: string | null;
  error: string | null;
  loading: boolean;
}
