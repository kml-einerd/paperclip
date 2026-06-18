/**
 * attach-gstack-skills.ts — attach imported gstack company_skills to agents by
 * role/name, writing adapterConfig.paperclipSkillSync.desiredSkills via the same
 * helper the /agents/:id/skills/sync route uses. Idempotent: desiredSkills is a
 * set, and required skills are merged in by the runtime regardless.
 *
 * Philosophy (operator rule): attach only what an agent actually uses — no dead
 * skills. ios-* skills are left in the catalog but attached to nobody (no device).
 *
 * Usage:
 *   tsx scripts/attach-gstack-skills.ts <companyId> [pgUrl]
 */
import { createDb } from "@paperclipai/db";
import { companySkillService, agentService } from "../src/services/index.js";
import { writePaperclipSkillSyncPreference } from "@paperclipai/adapter-utils/server-utils";

// Universal tier-1: useful to essentially every working agent.
const UNIVERSAL = ["review", "investigate", "learn", "context-save", "context-restore"];

// Per-agent (matched by name substring, first match wins for the specific set;
// UNIVERSAL is always unioned in). Keep lists tight — only genuinely-used skills.
const BY_NAME: Array<{ match: RegExp; skills: string[] }> = [
  { match: /^ceo$/, skills: ["plan-ceo-review", "autoplan", "office-hours", "retro", "health"] },
  { match: /akita-senior|^dev$|^dev-/, skills: ["ship", "qa", "cso", "plan-eng-review", "health", "land-and-deploy", "scrape", "browse"] },
  { match: /design/, skills: ["design-review", "design-consultation", "design-shotgun", "design-html", "plan-design-review", "browse"] },
  { match: /copy|content|briefer/, skills: ["document-generate", "document-release", "diagram", "make-pdf", "office-hours"] },
  { match: /ops-/, skills: ["autoplan", "plan-tune", "devex-review", "canary", "benchmark", "retro"] },
  { match: /researcher|pattern-mapper/, skills: ["scrape", "browse", "benchmark-models", "diagram", "cso"] },
  { match: /editor-video/, skills: ["make-pdf", "landing-report", "diagram"] },
  { match: /pmos-bridge|hermes/, skills: ["ship", "investigate"] },
];

async function main() {
  const [companyId, pgUrlArg] = process.argv.slice(2);
  if (!companyId) {
    console.error("usage: tsx scripts/attach-gstack-skills.ts <companyId> [pgUrl]");
    process.exit(1);
  }
  const pgUrl =
    pgUrlArg ??
    process.env.DATABASE_URL ??
    "postgres://paperclip:paperclip@127.0.0.1:54329/paperclip";

  const db = createDb(pgUrl);
  const skills = companySkillService(db);
  const agentsSvc = agentService(db);

  // slug -> key map for the gstack (local/*) skills
  const allSkills = await skills.list(companyId);
  const slugToKey = new Map<string, string>();
  for (const s of allSkills) {
    if (s.key.startsWith("local/")) slugToKey.set(s.slug, s.key);
  }

  const resolve = (slugs: string[]): string[] =>
    slugs.map((sl) => slugToKey.get(sl)).filter((k): k is string => Boolean(k));

  const agents = await agentsSvc.list(companyId);
  let touched = 0;
  for (const agent of agents) {
    if (agent.status === "terminated") continue; // skip fired agents
    const specific = BY_NAME.find((r) => r.match.test(agent.name));
    const wanted = [...UNIVERSAL, ...(specific?.skills ?? [])];
    const keys = resolve(wanted);
    if (keys.length === 0) continue;

    const nextConfig = writePaperclipSkillSyncPreference(
      (agent.adapterConfig as Record<string, unknown>) ?? {},
      keys,
    );
    await agentsSvc.update(agent.id, { adapterConfig: nextConfig });
    touched++;
    console.log(`  ✓ ${agent.name} (${agent.role}) <- ${keys.length} skills: ${wanted.join(", ")}`);
  }
  console.log(`\nDone. ${touched} agents updated.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
