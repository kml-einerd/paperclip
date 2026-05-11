import type {
  AdapterExecutionContext,
  AdapterExecutionResult,
} from "@paperclipai/adapter-utils";
import { asString } from "@paperclipai/adapter-utils/server-utils";
import { randomUUID } from "node:crypto";

interface PMOSDispatch {
  recipe?: string;
  intent?: string;
  params?: Record<string, unknown>;
}

async function fetchIssueMetadata(
  paperclipApiUrl: string,
  issueId: string,
  authToken?: string,
): Promise<Record<string, unknown> | null> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    const res = await fetch(`${paperclipApiUrl}/api/issues/${issueId}`, { headers });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    return (data?.metadata ?? null) as Record<string, unknown> | null;
  } catch {
    return null;
  }
}

function pickObject(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const url = asString(ctx.config.url, "http://localhost:8080").trim();
  const apiKey = asString(ctx.config.apiKey, "").trim();
  const paperclipApiUrl = asString(ctx.config.paperclipApiUrl, "http://localhost:3100").trim();

  await ctx.onLog("stdout", `[pmos-gateway] Dispatching run to Pmos at ${url}/api/v2/run\n`);

  // Resolve dispatch payload, priority:
  // 1) issue.metadata.recipe + issue.metadata.params (per-issue routing)
  // 2) adapterConfig.recipe + adapterConfig.params (per-agent default)
  // 3) adapterConfig.intent OR adapterConfig.promptTemplate (Morgan ad-hoc plan)
  const issueId = (ctx.context as any)?.issueId;
  let issueMeta: Record<string, unknown> | null = null;
  if (issueId && typeof issueId === "string") {
    issueMeta = await fetchIssueMetadata(paperclipApiUrl, issueId, ctx.authToken);
    if (issueMeta) {
      await ctx.onLog("stdout", `[pmos-gateway] Loaded issue ${issueId} metadata\n`);
    }
  }

  const dispatch: PMOSDispatch = {};
  const metaRecipe = asString(issueMeta?.recipe, "").trim();
  const cfgRecipe = asString(ctx.config.recipe, "").trim();
  const cfgIntent = asString(ctx.config.intent, "").trim();
  const cfgPrompt = asString((ctx.agent?.adapterConfig as any)?.promptTemplate, "").trim();

  if (metaRecipe) {
    dispatch.recipe = metaRecipe;
    const p = pickObject(issueMeta?.params);
    if (p) dispatch.params = p;
  } else if (cfgRecipe) {
    dispatch.recipe = cfgRecipe;
    const p = pickObject(ctx.config.params);
    if (p) dispatch.params = p;
  } else if (cfgIntent) {
    dispatch.intent = cfgIntent;
  } else if (cfgPrompt) {
    dispatch.intent = cfgPrompt;
  }

  if (!dispatch.recipe && !dispatch.intent) {
    const msg =
      "No recipe/intent resolved: issue.metadata.recipe absent and adapterConfig.recipe/intent/promptTemplate empty";
    await ctx.onLog("stderr", `[pmos-gateway] ${msg}\n`);
    return { exitCode: 1, signal: null, timedOut: false, errorMessage: msg };
  }

  const body: any = {
    context: (ctx as any).workspace?.env || {},
    paperclip_ctx: { runId: ctx.runId, agentId: ctx.agent?.id },
  };

  if (dispatch.recipe) {
    body.recipe = dispatch.recipe;
    if (dispatch.params) body.params = dispatch.params;
  } else {
    body.intent = dispatch.intent;
  }

  try {
    const runRes = await fetch(`${url}/api/v2/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
        "Idempotency-Key": randomUUID(),
      },
      body: JSON.stringify(body),
    });

    if (!runRes.ok) {
      const errText = await runRes.text();
      await ctx.onLog("stderr", `[pmos-gateway] PM-OS Error: ${runRes.status} ${errText}\n`);
      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorMessage: `PM-OS Error: ${runRes.status} ${errText}`,
      };
    }

    const runData = (await runRes.json()) as any;
    const pmosRunId = runData.run_id || runData.id;
    await ctx.onLog("stdout", `[pmos-gateway] Run created with ID: ${pmosRunId}\n`);

    while (true) {
      if ((ctx as any).signal?.aborted || (ctx as any).abortSignal?.aborted) {
        await ctx.onLog("stdout", `[pmos-gateway] Run aborted by user.\n`);
        return { exitCode: 1, signal: "SIGTERM", timedOut: false, errorMessage: "Aborted" };
      }

      await new Promise((r) => setTimeout(r, 2000));
      const statusRes = await fetch(`${url}/api/v2/runs/${pmosRunId}`, {
        headers: { "X-Api-Key": apiKey },
      });
      if (!statusRes.ok) continue;
      const statusData = (await statusRes.json()) as any;

      if (statusData.status === "completed") {
        await ctx.onLog("stdout", `[pmos-gateway] Run completed successfully.\n`);
        if (statusData.output) {
          await ctx.onLog(
            "stdout",
            `[pmos-gateway:event] run=${ctx.runId} stream=assistant data={"text":"${JSON.stringify(
              statusData.output,
            ).slice(1, -1)}"}\n`,
          );
        }
        return { exitCode: 0, signal: null, timedOut: false };
      }
      if (statusData.status === "failed") {
        await ctx.onLog("stderr", `[pmos-gateway] Run failed: ${statusData.error}\n`);
        return { exitCode: 1, signal: null, timedOut: false, errorMessage: statusData.error };
      }
      await ctx.onLog("stdout", `[pmos-gateway] Status: ${statusData.status}...\n`);
    }
  } catch (err: any) {
    await ctx.onLog("stderr", `[pmos-gateway] Exception: ${err.message}\n`);
    return { exitCode: 1, signal: null, timedOut: false, errorMessage: err.message };
  }
}

export function testEnvironment(): Promise<{ ok: true } | { ok: false; reason: string }> {
  return Promise.resolve({ ok: true });
}
