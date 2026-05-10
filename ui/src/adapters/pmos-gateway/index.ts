import type { UIAdapterModule } from "../types";
import { parsePmosGatewayStdoutLine } from "@paperclipai/adapter-pmos-gateway/ui";
import { buildPmosGatewayConfig } from "@paperclipai/adapter-pmos-gateway/ui";
import { PmosGatewayConfigFields } from "./config-fields";

export const pmosGatewayUIAdapter: UIAdapterModule = {
  type: "pmos_gateway",
  label: "PM-OS Gateway",
  parseStdoutLine: parsePmosGatewayStdoutLine,
  ConfigFields: PmosGatewayConfigFields,
  buildAdapterConfig: buildPmosGatewayConfig,
};
