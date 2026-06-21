import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { pruneOldBackups, type BackupRetentionPolicy } from "./backup-lib.js";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
});

const PREFIX = "paperclip";
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function createBackupDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-prune-"));
  cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** Write a backup file with `mtime` set to `ageMs` before now. Returns the basename. */
function writeBackup(dir: string, ageMs: number, label: string): string {
  const name = `${PREFIX}-${label}.sql.gz`;
  const full = path.join(dir, name);
  fs.writeFileSync(full, "x");
  const mtime = new Date(Date.now() - ageMs);
  fs.utimesSync(full, mtime, mtime);
  return name;
}

function listBackups(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((n) => n.startsWith(`${PREFIX}-`))
    .sort();
}

const FULL_POLICY: BackupRetentionPolicy = {
  hourlyHours: 48,
  dailyDays: 14,
  weeklyWeeks: 8,
  monthlyMonths: 1,
  maxFiles: 200,
};

describe("pruneOldBackups", () => {
  it("keeps every backup inside the hourly window", () => {
    const dir = createBackupDir();
    // 24 hourly backups within the last 24h — all inside the 48h hourly tier.
    for (let h = 0; h < 24; h += 1) {
      writeBackup(dir, h * HOUR, `h${String(h).padStart(2, "0")}`);
    }
    const pruned = pruneOldBackups(dir, FULL_POLICY, PREFIX);
    expect(pruned).toBe(0);
    expect(listBackups(dir)).toHaveLength(24);
  });

  it("collapses hourly backups older than the hourly window to one per day", () => {
    const dir = createBackupDir();
    // Day 0 (now): 5 hourly backups, all within 48h → kept by hourly tier.
    for (let h = 0; h < 5; h += 1) {
      writeBackup(dir, h * HOUR, `today-h${h}`);
    }
    // Day ~4 (past the 48h hourly tier, within the 14d daily tier): 4 backups
    // clustered within a 30-minute span so they share a calendar day regardless
    // of wall-clock time → daily tier keeps only the newest of that bucket.
    const dayBase = 4 * DAY;
    writeBackup(dir, dayBase + 0 * 60 * 1000, "d4-newest");
    writeBackup(dir, dayBase + 10 * 60 * 1000, "d4-mid1");
    writeBackup(dir, dayBase + 20 * 60 * 1000, "d4-mid2");
    writeBackup(dir, dayBase + 30 * 60 * 1000, "d4-oldest");

    const before = listBackups(dir);
    expect(before).toHaveLength(9);

    const pruned = pruneOldBackups(dir, FULL_POLICY, PREFIX);
    const after = listBackups(dir);
    // The 5 recent hourly backups survive untouched. The 4 clustered day-4
    // backups collapse to one-per-calendar-day: the cluster spans at most two
    // calendar days, so at least 2 are pruned and the newest is always kept.
    expect(after).toContain(`${PREFIX}-d4-newest.sql.gz`);
    expect(after).toContain(`${PREFIX}-today-h0.sql.gz`);
    expect(pruned).toBeGreaterThanOrEqual(2);
    expect(after.length).toBeGreaterThanOrEqual(6);
    expect(after.length).toBeLessThanOrEqual(7);
  });

  it("deletes backups older than all retention tiers", () => {
    const dir = createBackupDir();
    writeBackup(dir, 1 * HOUR, "recent");
    // ~400 days old — beyond hourly/daily/weekly/monthly tiers.
    writeBackup(dir, 400 * DAY, "ancient");
    const pruned = pruneOldBackups(dir, FULL_POLICY, PREFIX);
    expect(pruned).toBe(1);
    expect(listBackups(dir)).toEqual([`${PREFIX}-recent.sql.gz`]);
  });

  it("enforces the absolute maxFiles backstop, dropping the oldest survivors", () => {
    const dir = createBackupDir();
    // 10 hourly backups all within the hourly window (would all survive tiers),
    // but maxFiles=3 caps retention to the 3 newest.
    for (let h = 0; h < 10; h += 1) {
      writeBackup(dir, h * HOUR, `h${String(h).padStart(2, "0")}`);
    }
    const policy: BackupRetentionPolicy = { ...FULL_POLICY, maxFiles: 3 as never };
    const pruned = pruneOldBackups(dir, policy, PREFIX);
    expect(pruned).toBe(7);
    const after = listBackups(dir);
    expect(after).toHaveLength(3);
    // Newest 3 survive (h00, h01, h02 are the most recent).
    expect(after).toContain(`${PREFIX}-h00.sql.gz`);
    expect(after).toContain(`${PREFIX}-h02.sql.gz`);
    expect(after).not.toContain(`${PREFIX}-h03.sql.gz`);
  });

  it("regression: an hourly cadence does not retain ~168 files for a week", () => {
    const dir = createBackupDir();
    // Simulate 7 days of hourly backups: 7*24 = 168 files. This is the NOV-1293
    // shape (169 files / 11G). With the hourly+daily tiers, the past-48h ones
    // collapse to 1/day instead of 24/day.
    for (let h = 0; h < 7 * 24; h += 1) {
      writeBackup(dir, h * HOUR, `h${String(h).padStart(3, "0")}`);
    }
    expect(listBackups(dir)).toHaveLength(168);
    pruneOldBackups(dir, FULL_POLICY, PREFIX);
    const after = listBackups(dir);
    // 48h hourly tier (~48 files spanning calendar boundaries) + 1/day for the
    // remaining days. Far below 168 and below the 200 cap.
    expect(after.length).toBeLessThan(60);
    expect(after.length).toBeGreaterThan(40);
  });

  it("applies safe defaults when hourlyHours/maxFiles are omitted (legacy policy)", () => {
    const dir = createBackupDir();
    // Legacy persisted policy without the new fields.
    const legacy = { dailyDays: 7, weeklyWeeks: 4, monthlyMonths: 1 } as BackupRetentionPolicy;
    for (let h = 0; h < 10; h += 1) {
      writeBackup(dir, h * HOUR, `h${String(h).padStart(2, "0")}`);
    }
    // All within default 48h hourly window → none pruned.
    const pruned = pruneOldBackups(dir, legacy, PREFIX);
    expect(pruned).toBe(0);
    expect(listBackups(dir)).toHaveLength(10);
  });
});
