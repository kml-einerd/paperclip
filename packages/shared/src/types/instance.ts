import type { FeedbackDataSharingPreference } from "./feedback.js";

export const HOURLY_RETENTION_PRESETS = [24, 48, 72] as const;
export const DAILY_RETENTION_PRESETS = [3, 7, 14] as const;
export const WEEKLY_RETENTION_PRESETS = [1, 2, 4, 8] as const;
export const MONTHLY_RETENTION_PRESETS = [1, 3, 6] as const;
export const MAX_FILES_PRESETS = [100, 200, 500] as const;
export const DEFAULT_ISSUE_GRAPH_LIVENESS_AUTO_RECOVERY_LOOKBACK_HOURS = 24;
export const MIN_ISSUE_GRAPH_LIVENESS_AUTO_RECOVERY_LOOKBACK_HOURS = 1;
export const MAX_ISSUE_GRAPH_LIVENESS_AUTO_RECOVERY_LOOKBACK_HOURS = 24 * 30;

export interface BackupRetentionPolicy {
  /**
   * Hourly tier: keep EVERY backup taken within the last `hourlyHours` hours.
   * This is the tier that bounds the disk cost of an hourly backup cadence —
   * without it, the daily tier kept all 24 dumps/day for `dailyDays` days
   * (~168 files / ~13G for an 81M hourly dump, the NOV-1293 disk-98% incident).
   */
  hourlyHours: (typeof HOURLY_RETENTION_PRESETS)[number];
  /** Daily tier: keep the NEWEST backup per calendar day for `dailyDays` days. */
  dailyDays: (typeof DAILY_RETENTION_PRESETS)[number];
  /** Weekly tier: keep the NEWEST backup per calendar week for `weeklyWeeks` weeks. */
  weeklyWeeks: (typeof WEEKLY_RETENTION_PRESETS)[number];
  /** Monthly tier: keep the NEWEST backup per calendar month for `monthlyMonths` months. */
  monthlyMonths: (typeof MONTHLY_RETENTION_PRESETS)[number];
  /**
   * Absolute backstop: never retain more than `maxFiles` backups regardless of
   * the tier rules. The oldest files beyond this count are pruned. Guards
   * against runaway growth if the host clock or backup cadence misbehaves.
   */
  maxFiles: (typeof MAX_FILES_PRESETS)[number];
}

export const DEFAULT_BACKUP_RETENTION: BackupRetentionPolicy = {
  hourlyHours: 48,
  dailyDays: 14,
  weeklyWeeks: 8,
  monthlyMonths: 1,
  maxFiles: 200,
};

export interface InstanceGeneralSettings {
  censorUsernameInLogs: boolean;
  keyboardShortcuts: boolean;
  feedbackDataSharingPreference: FeedbackDataSharingPreference;
  backupRetention: BackupRetentionPolicy;
}

export interface InstanceExperimentalSettings {
  enableEnvironments: boolean;
  enableIsolatedWorkspaces: boolean;
  autoRestartDevServerWhenIdle: boolean;
  enableIssueGraphLivenessAutoRecovery: boolean;
  issueGraphLivenessAutoRecoveryLookbackHours: number;
}

export interface InstanceSettings {
  id: string;
  general: InstanceGeneralSettings;
  experimental: InstanceExperimentalSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface IssueGraphLivenessAutoRecoveryPreviewItem {
  issueId: string;
  identifier: string | null;
  title: string;
  state: string;
  severity: string;
  reason: string;
  recoveryIssueId: string;
  recoveryIdentifier: string | null;
  recoveryTitle: string | null;
  recommendedOwnerAgentId: string | null;
  incidentKey: string;
  latestDependencyUpdatedAt: string;
  dependencyPath: Array<{
    issueId: string;
    identifier: string | null;
    title: string;
    status: string;
  }>;
}

export interface IssueGraphLivenessAutoRecoveryPreview {
  lookbackHours: number;
  cutoff: string;
  generatedAt: string;
  findings: number;
  recoverableFindings: number;
  skippedOutsideLookback: number;
  items: IssueGraphLivenessAutoRecoveryPreviewItem[];
}
