import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";
import { asString, parseObject } from "@paperclipai/adapter-utils/server-utils";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const urlValue = asString(config.url, "").trim();

  if (!urlValue) {
    checks.push({
      code: "pmos_gateway_url_missing",
      level: "error",
      message: "PM-OS gateway adapter requires a base URL.",
      hint: "Set adapterConfig.url to http://localhost:8080 (PM-OS API address).",
    });
    return {
      adapterType: ctx.adapterType,
      status: summarizeStatus(checks),
      checks,
      testedAt: new Date().toISOString(),
    };
  }

  let url: URL | null = null;
  try {
    url = new URL(urlValue);
  } catch {
    checks.push({
      code: "pmos_gateway_url_invalid",
      level: "error",
      message: `Invalid URL: ${urlValue}`,
    });
  }

  if (url) {
    checks.push({
      code: "pmos_gateway_url_valid",
      level: "info",
      message: `Configured PM-OS URL: ${url.toString()}`,
    });
  }

  const apiKey = nonEmpty(config.apiKey);
  if (apiKey) {
    checks.push({
      code: "pmos_gateway_apikey_present",
      level: "info",
      message: "PM-OS API key is configured.",
    });
  } else {
    checks.push({
      code: "pmos_gateway_apikey_missing",
      level: "warn",
      message: "No PM-OS API key detected in adapter config.",
      hint: "Set adapterConfig.apiKey for authenticated PM-OS access.",
    });
  }

  // Probe PM-OS health endpoint
  if (url) {
    try {
      const healthRes = await fetch(`${url.origin}/api/health`, {
        headers: apiKey ? { "X-Api-Key": apiKey } : {},
        signal: AbortSignal.timeout(5000),
      });

      if (healthRes.ok) {
        const data = (await healthRes.json()) as Record<string, unknown>;
        checks.push({
          code: "pmos_gateway_health_ok",
          level: "info",
          message: `PM-OS is healthy (status: ${data.status ?? "ok"}, version: ${data.version ?? "unknown"}).`,
        });
      } else {
        checks.push({
          code: "pmos_gateway_health_fail",
          level: "warn",
          message: `PM-OS health check returned ${healthRes.status}.`,
          hint: "Verify PM-OS is running and reachable from the Paperclip server.",
        });
      }
    } catch (err) {
      checks.push({
        code: "pmos_gateway_health_error",
        level: "warn",
        message: `PM-OS health probe failed: ${err instanceof Error ? err.message : "unknown error"}`,
        hint: "Verify PM-OS is running at the configured URL.",
      });
    }
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
