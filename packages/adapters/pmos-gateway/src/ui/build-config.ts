import type { CreateConfigValues } from "@paperclipai/adapter-utils";

export function buildPmosGatewayConfig(v: CreateConfigValues): Record<string, unknown> {
  const ac: Record<string, unknown> = {};
  if (v.url) ac.url = v.url;
  if ((v as unknown as Record<string, unknown>).apiKey) ac.apiKey = (v as unknown as Record<string, unknown>).apiKey;
  ac.paperclipApiUrl = "http://localhost:3100";
  return ac;
}
