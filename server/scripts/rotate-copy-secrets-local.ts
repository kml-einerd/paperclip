/**
 * rotate-copy-secrets-local.ts — repointa os secrets do copy-intelligence do
 * Supabase remoto para o Supabase LOCAL (databases_kml/copy). Mantém os mesmos
 * secretIds (os agentes já estão bindados), só troca o valor.
 *
 * Uso: tsx scripts/rotate-copy-secrets-local.ts [pgUrl]
 */
import { createDb } from "@paperclipai/db";
import { secretService } from "../src/services/index.js";

const LOCAL_URL = "http://127.0.0.1:54421";
const LOCAL_SERVICE_KEY =
  "eyJhbGciOiJFUzI1NiIsImtpZCI6ImI4MTI2OWYxLTIxZDgtNGYyZS1iNzE5LWMyMjQwYTg0MGQ5MCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MjA5NzE2MjAxM30.URAOGjwt_juRXjMNRkCA3A6DnRtO37C0g-8_7rqPOiPeSNAYhrMh3GHyHL8mgfJ13rSapSlBdDeFiDFoRDmCsw";

const URL_SECRET_ID = "1381fad1-ebff-463c-b2db-d7ab94ccbbad";
const KEY_SECRET_ID = "eb2cb243-be2b-4235-b2b1-0acc5a141d64";

async function main() {
  const pgUrl = process.argv[2] ?? process.env.DATABASE_URL ?? "postgres://paperclip:paperclip@127.0.0.1:54329/paperclip";
  const db = createDb(pgUrl);
  const svc = secretService(db);

  await svc.rotate(URL_SECRET_ID, { value: LOCAL_URL });
  console.log(`  ✓ URL -> ${LOCAL_URL}`);
  await svc.rotate(KEY_SECRET_ID, { value: LOCAL_SERVICE_KEY });
  console.log(`  ✓ SERVICE_KEY -> (local service_role)`);
  console.log("\nSecrets repointados pro Supabase local. Agentes copy-* já bindados pegam no próximo run.");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
