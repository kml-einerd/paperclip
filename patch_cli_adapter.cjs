const fs = require('fs');

const registryTs = '/home/agdis/Desktop/nova-era-work/nova-era/paperclip/cli/src/adapters/registry.ts';
let registryContent = fs.readFileSync(registryTs, 'utf8');

const importStatement = 'import { printPmosGatewayStreamEvent } from "@paperclipai/adapter-pmos-gateway/cli";';
registryContent = registryContent.replace('import { printOpenClawGatewayStreamEvent } from "@paperclipai/adapter-openclaw-gateway/cli";', importStatement + '\nimport { printOpenClawGatewayStreamEvent } from "@paperclipai/adapter-openclaw-gateway/cli";');

const adapterDef = `
const pmosGatewayCLIAdapter: CLIAdapterModule = {
  type: "pmos_gateway",
  formatStdoutEvent: printPmosGatewayStreamEvent,
};
`;

registryContent = registryContent.replace('const openclawGatewayCLIAdapter: CLIAdapterModule = {', adapterDef + '\nconst openclawGatewayCLIAdapter: CLIAdapterModule = {');
registryContent = registryContent.replace('openclawGatewayCLIAdapter,', 'openclawGatewayCLIAdapter,\n    pmosGatewayCLIAdapter,');

fs.writeFileSync(registryTs, registryContent);
console.log('Patched', registryTs);
