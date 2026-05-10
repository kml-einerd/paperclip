import type {
  AdapterExecutionContext,
  AdapterExecutionResult,
} from "@paperclipai/adapter-utils";
import { asString } from "@paperclipai/adapter-utils/server-utils";
import { randomUUID } from "node:crypto";

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const url = asString(ctx.config.url, "http://localhost:8080").trim();
  const apiKey = asString(ctx.config.apiKey, "").trim();

  await ctx.onLog("stdout", `[pmos-gateway] Dispatching run to Pmos at ${url}/api/v2/run\n`);

  try {
    const runRes = await fetch(`${url}/api/v2/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
        "Idempotency-Key": randomUUID(),
      },
      body: JSON.stringify({
        input: (ctx.agent?.adapterConfig as any)?.promptTemplate || "Execute standard PM-OS recipe",
        context: (ctx as any).workspace?.env || {},
        paperclip_ctx: {
          runId: ctx.runId,
          agentId: ctx.agent?.id
        }
        })
        });

        if (!runRes.ok) {
        const errText = await runRes.text();
        await ctx.onLog("stderr", `[pmos-gateway] PM-OS Error: ${runRes.status} ${errText}\n`);
        return { exitCode: 1, signal: null, timedOut: false, errorMessage: `PM-OS Error: ${runRes.status} ${errText}` };
        }

        const runData = await runRes.json() as any;
        const runId = runData.run_id || runData.id;
        await ctx.onLog("stdout", `[pmos-gateway] Run created with ID: ${runId}\n`);

        // Basic polling
        while (true) {
        if ((ctx as any).signal?.aborted || (ctx as any).abortSignal?.aborted) {
        await ctx.onLog("stdout", `[pmos-gateway] Run aborted by user.\n`);
        return { exitCode: 1, signal: "SIGTERM", timedOut: false, errorMessage: "Aborted" };
      }

      await new Promise(r => setTimeout(r, 2000));
      const statusRes = await fetch(`${url}/api/v2/runs/${runId}`, {
        headers: { "X-Api-Key": apiKey }
      });
      if (!statusRes.ok) continue;
      const statusData = await statusRes.json() as any;
      
      if (statusData.status === "completed") {
        await ctx.onLog("stdout", `[pmos-gateway] Run completed successfully.\n`);
        // If Pmos returns final text, we can output it as a standard Paperclip event so UI knows it's the answer.
        if (statusData.output) {
           await ctx.onLog("stdout", `[pmos-gateway:event] run=${ctx.runId} stream=assistant data={"text":"${JSON.stringify(statusData.output).slice(1, -1)}"}\n`);
        }
        return { exitCode: 0, signal: null, timedOut: false };
      }
      if (statusData.status === "failed") {
        await ctx.onLog("stderr", `[pmos-gateway] Run failed: ${statusData.error}\n`);
        return { exitCode: 1, signal: null, timedOut: false, errorMessage: statusData.error };
      }
      // Running
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
