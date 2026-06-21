import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  cleanStopEmbeddedPostgres,
  cleanupOrphanSharedMemoryOnStart,
  parseOrphanSharedMemory,
} from "./embedded-postgres-shutdown.js";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
});

function createDataDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-pg-shutdown-"));
  cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/**
 * Build a realistic postmaster.pid. PG layout (since 9.6):
 *   1 pid, 2 datadir, 3 start epoch, 4 port, 5 socket dir,
 *   6 listen addr, 7 "<shmKey> <shmId>", 8 status.
 */
function writePostmasterPid(dataDir: string, shmKey: number, shmId: number): void {
  const lines = [
    "12345",
    dataDir,
    "1700000000",
    "5432",
    "/tmp",
    "localhost",
    `${shmKey}  ${shmId}`,
    "ready",
  ];
  fs.writeFileSync(path.join(dataDir, "postmaster.pid"), lines.join("\n") + "\n");
}

describe("parseOrphanSharedMemory", () => {
  it("parses the shmem key and id from line 7 of postmaster.pid", () => {
    const dir = createDataDir();
    writePostmasterPid(dir, 3781290, 163844);
    expect(parseOrphanSharedMemory(dir)).toEqual({ key: 3781290, id: 163844 });
  });

  it("returns null when postmaster.pid is absent", () => {
    const dir = createDataDir();
    expect(parseOrphanSharedMemory(dir)).toBeNull();
  });

  it("returns null when the shmem line is 0 0 (no segment)", () => {
    const dir = createDataDir();
    writePostmasterPid(dir, 0, 0);
    expect(parseOrphanSharedMemory(dir)).toBeNull();
  });

  it("returns null for a truncated pid file without the shmem line", () => {
    const dir = createDataDir();
    fs.writeFileSync(path.join(dir, "postmaster.pid"), "12345\n" + dir + "\n");
    expect(parseOrphanSharedMemory(dir)).toBeNull();
  });
});

describe("cleanupOrphanSharedMemoryOnStart", () => {
  it("no-ops and returns null when there is no pid file", async () => {
    const dir = createDataDir();
    await expect(cleanupOrphanSharedMemoryOnStart(dir)).resolves.toBeNull();
  });

  it("attempts removal of a parsed segment (ipcrm best-effort)", async () => {
    const dir = createDataDir();
    // A key/id that does not exist on the host; ipcrm fails → removal returns
    // false → helper returns null. The point is it parses + attempts without throwing.
    writePostmasterPid(dir, 999_999_991, 999_999_992);
    await expect(cleanupOrphanSharedMemoryOnStart(dir)).resolves.toBeNull();
  });
});

describe("cleanStopEmbeddedPostgres", () => {
  it("returns ok=false when pg_ctl is missing instead of throwing", async () => {
    const dir = createDataDir();
    const result = await cleanStopEmbeddedPostgres(path.join(dir, "no-such-pg_ctl"), dir);
    expect(result.ok).toBe(false);
    expect(result.stderr).toContain("pg_ctl not found");
  });
});
