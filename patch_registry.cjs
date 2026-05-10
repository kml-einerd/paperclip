const fs = require('fs');
const file = '/home/agdis/Desktop/nova-era-work/nova-era/paperclip/server/src/adapters/registry.ts';
let code = fs.readFileSync(file, 'utf8');

const importStatement = `
import {
  execute as pmosGatewayExecute,
  testEnvironment as pmosGatewayTestEnvironment,
} from "@paperclipai/adapter-pmos-gateway/server";
import {
  agentConfigurationDoc as pmosGatewayAgentConfigurationDoc,
  models as pmosGatewayModels,
} from "@paperclipai/adapter-pmos-gateway";
`;

const adapterDef = `
const pmosGatewayAdapter: ServerAdapterModule = {
  type: "pmos_gateway",
  execute: pmosGatewayExecute,
  testEnvironment: pmosGatewayTestEnvironment,
  models: pmosGatewayModels,
  supportsLocalAgentJwt: false,
  supportsInstructionsBundle: false,
  requiresMaterializedRuntimeSkills: false,
  agentConfigurationDoc: pmosGatewayAgentConfigurationDoc,
};
`;

code = code.replace('import { listCodexModels', importStatement + '\nimport { listCodexModels');
code = code.replace('const openclawGatewayAdapter', adapterDef + '\nconst openclawGatewayAdapter');
code = code.replace('openclawGatewayAdapter,', 'openclawGatewayAdapter,\n    pmosGatewayAdapter,');

fs.writeFileSync(file, code);
console.log('patched server/src/adapters/registry.ts');