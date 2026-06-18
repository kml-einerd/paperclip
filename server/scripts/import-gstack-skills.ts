/**
 * import-gstack-skills.ts — import all generated gstack SKILL.md dirs into a
 * Paperclip company as company_skills rows, using the OFFICIAL company-skill
 * service (same code path as POST /companies/:id/skills/import), so parsing,
 * inventory, trust-level, and upsert-by-key all behave identically to the UI.
 *
 * Connects to the already-running embedded postgres (no second instance).
 *
 * Usage:
 *   tsx scripts/import-gstack-skills.ts <companyId> <skillsRootDir> [pgUrl]
 *
 * Example:
 *   tsx scripts/import-gstack-skills.ts \
 *     e382820d-5676-4aa2-b8e8-8a5cb8dbd3f1 \
 *     /home/agdev/nova-era/vendor/gstack/.paperclip-gstack/skills
 */
import { readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { createDb } from "@paperclipai/db";
import { companySkillService } from "../src/services/index.js";

async function main() {
  const [companyId, skillsRoot, pgUrlArg] = process.argv.slice(2);
  if (!companyId || !skillsRoot) {
    console.error(
      "usage: tsx scripts/import-gstack-skills.ts <companyId> <skillsRootDir> [pgUrl]",
    );
    process.exit(1);
  }
  const pgUrl =
    pgUrlArg ??
    process.env.DATABASE_URL ??
    "postgres://paperclip:paperclip@127.0.0.1:54329/paperclip";

  const db = createDb(pgUrl);
  const svc = companySkillService(db);

  const entries = readdirSync(skillsRoot)
    .map((name) => join(skillsRoot, name))
    .filter((p) => statSync(p).isDirectory() && existsSync(join(p, "SKILL.md")));

  console.log(`Found ${entries.length} skill dirs under ${skillsRoot}`);

  let ok = 0;
  let failed = 0;
  for (const dir of entries) {
    try {
      const result = await svc.importFromSource(companyId, dir);
      const imported = result.imported ?? [];
      const warns = result.warnings ?? [];
      console.log(
        `  ✓ ${dir.split("/").pop()} -> ${imported
          .map((s: { key: string }) => s.key)
          .join(", ")}${warns.length ? ` (warnings: ${warns.length})` : ""}`,
      );
      ok += imported.length;
    } catch (err) {
      failed++;
      console.error(`  ✗ ${dir.split("/").pop()}: ${(err as Error).message}`);
    }
  }
  console.log(`\nDone. ${ok} skills imported, ${failed} dirs failed.`);
  process.exit(failed > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
