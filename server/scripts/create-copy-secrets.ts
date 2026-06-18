/**
 * create-copy-secrets.ts — cria os secrets do banco copy-intelligence (Supabase)
 * como company_secrets local_encrypted, em vez de deixar a service_role key em
 * plain-text no prompt do agente. Imprime os secretIds para bindar via envConfig.
 *
 * Idempotente: se o secret já existe (mesmo name), reaproveita o id.
 *
 * Uso: tsx scripts/create-copy-secrets.ts <companyId> [pgUrl]
 */
import { createDb } from "@paperclipai/db";
import { secretService } from "../src/services/index.js";

const SUPABASE_URL = "https://enljemrmaxcddfboxhfw.supabase.co";
const SUPABASE_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVubGplbXJtYXhjZGRmYm94aGZ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTAxMjk3NywiZXhwIjoyMDkwNTg4OTc3fQ.dVTXIOdzWYsyvB7IXQhxKia6kbdHaoVVFQMHykjXu5I";

async function ensure(svc: ReturnType<typeof secretService>, companyId: string, name: string, value: string, description: string) {
  const existing = await svc.getByName(companyId, name);
  if (existing) {
    console.log(`  • já existe: ${name} -> ${existing.id}`);
    return existing.id;
  }
  const created = await svc.create(
    companyId,
    { name, provider: "local_encrypted", value, description },
    { agentId: null, userId: null },
  );
  console.log(`  ✓ criado: ${name} -> ${created.id}`);
  return created.id;
}

async function main() {
  const [companyId, pgUrlArg] = process.argv.slice(2);
  if (!companyId) {
    console.error("usage: tsx scripts/create-copy-secrets.ts <companyId> [pgUrl]");
    process.exit(1);
  }
  const pgUrl = pgUrlArg ?? process.env.DATABASE_URL ?? "postgres://paperclip:paperclip@127.0.0.1:54329/paperclip";
  const db = createDb(pgUrl);
  const svc = secretService(db);

  const urlId = await ensure(svc, companyId, "COPY_INTEL_SUPABASE_URL", SUPABASE_URL, "Supabase URL do banco copy-intelligence");
  const keyId = await ensure(svc, companyId, "COPY_INTEL_SUPABASE_SERVICE_KEY", SUPABASE_SERVICE_KEY, "Supabase service_role key do banco copy-intelligence (copy-advisor + copy-extract)");

  console.log(`\nenvConfig para os agentes copy-*:`);
  console.log(JSON.stringify({
    COPY_INTEL_SUPABASE_URL: { type: "secret_ref", secretId: urlId },
    COPY_INTEL_SUPABASE_SERVICE_KEY: { type: "secret_ref", secretId: keyId },
  }, null, 2));
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
