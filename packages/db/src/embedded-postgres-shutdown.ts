import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Clean shutdown + orphan-shared-memory recovery for the embedded PostgreSQL
 * cluster.
 *
 * The `embedded-postgres` library's `.stop()` sends a single SIGINT to the
 * postmaster and resolves on the wrapper process `exit` event. Under a fast
 * systemd `SIGTERM` of the Paperclip server, the parent process can exit
 * (`process.exit(0)`) before the postmaster has finished detaching its System V
 * shared-memory segment, leaving an orphan segment behind. The next boot then
 * fails to bind with:
 *
 *   FATAL: pre-existing shared memory block (key <K>, ID <I>) is still in use
 *
 * and retry-loops until the OS reclaims the segment (~17 min in the NOV-1293
 * incident). These helpers make shutdown deterministic (`pg_ctl stop -m fast`,
 * which only returns once the postmaster has fully exited and released shmem)
 * and clean any orphan segment on start before the cluster comes up.
 */

const POSTMASTER_PID_FILE = "postmaster.pid";

/** Line index (0-based) in postmaster.pid carrying "<shmKey> <shmId>" (PG >= 9.6). */
const SHMEM_LINE_INDEX = 6;

export type OrphanSharedMemory = {
  key: number;
  id: number;
};

function runProcess(
  command: string,
  args: string[],
  timeoutMs: number,
): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString("utf-8");
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ code: null, stderr });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stderr });
    });
  });
}

/**
 * Parse the System V shared-memory key/id recorded on line 7 of postmaster.pid.
 * Returns null when the file is absent or the line cannot be parsed (older PG,
 * truncated file, or a postmaster that has not written the shmem line yet).
 */
export function parseOrphanSharedMemory(dataDir: string): OrphanSharedMemory | null {
  const pidFile = path.resolve(dataDir, POSTMASTER_PID_FILE);
  if (!existsSync(pidFile)) return null;
  let contents: string;
  try {
    contents = readFileSync(pidFile, "utf-8");
  } catch {
    return null;
  }
  const line = contents.split("\n")[SHMEM_LINE_INDEX]?.trim();
  if (!line) return null;
  // Format: "<key> <id>" (decimal). PG writes 0 0 when it has no shmem segment.
  const match = line.match(/^(\d+)\s+(\d+)/);
  if (!match) return null;
  const key = Number(match[1]);
  const id = Number(match[2]);
  if (!Number.isInteger(key) || !Number.isInteger(id) || key <= 0 || id <= 0) {
    return null;
  }
  return { key, id };
}

/**
 * Remove an orphan System V shared-memory segment via `ipcrm`. No-op on
 * platforms without `ipcrm` (Windows) or when removal fails (segment already
 * gone, or still attached — in which case the boot retry-loop still applies but
 * we have not made things worse). Returns true only when removal succeeded.
 */
export async function removeOrphanSharedMemory(
  shmem: OrphanSharedMemory,
  timeoutMs = 5_000,
): Promise<boolean> {
  if (process.platform === "win32") return false;
  // Prefer removal by id; ipcrm -m takes the shmid directly.
  const { code } = await runProcess("ipcrm", ["-m", String(shmem.id)], timeoutMs);
  return code === 0;
}

/**
 * Best-effort cleanup of an orphan shmem segment on start. Caller must only
 * invoke this when there is NO live postmaster for `dataDir` (a running cluster
 * legitimately owns its segment). Returns the segment that was removed, or null
 * when nothing needed cleaning.
 */
export async function cleanupOrphanSharedMemoryOnStart(
  dataDir: string,
): Promise<OrphanSharedMemory | null> {
  const shmem = parseOrphanSharedMemory(dataDir);
  if (!shmem) return null;
  const removed = await removeOrphanSharedMemory(shmem);
  return removed ? shmem : null;
}

/**
 * Stop the embedded cluster cleanly with `pg_ctl stop -m fast -w`. Unlike the
 * library `.stop()`, `pg_ctl -w` blocks until the postmaster has fully exited
 * and released its shared-memory segment, so a subsequent boot will not hit a
 * pre-existing-shmem FATAL. Returns true on a clean stop; false when pg_ctl is
 * unavailable or the stop failed (caller should fall back to library `.stop()`).
 */
export async function cleanStopEmbeddedPostgres(
  pgCtlPath: string,
  dataDir: string,
  timeoutSeconds = 30,
): Promise<{ ok: boolean; stderr: string }> {
  if (process.platform === "win32") return { ok: false, stderr: "pg_ctl stop unsupported on win32" };
  if (!existsSync(pgCtlPath)) return { ok: false, stderr: `pg_ctl not found at ${pgCtlPath}` };
  const { code, stderr } = await runProcess(
    pgCtlPath,
    ["stop", "-D", dataDir, "-m", "fast", "-w", "-t", String(timeoutSeconds)],
    (timeoutSeconds + 5) * 1_000,
  );
  return { ok: code === 0, stderr };
}
