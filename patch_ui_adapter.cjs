const fs = require('fs');
const path = require('path');

const pmosGatewayDir = '/home/agdis/Desktop/nova-era-work/nova-era/paperclip/ui/src/adapters/pmos-gateway';
const indexTs = path.join(pmosGatewayDir, 'index.ts');
const configFieldsTsx = path.join(pmosGatewayDir, 'config-fields.tsx');

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/openclaw-gateway/g, 'pmos-gateway');
    content = content.replace(/openclaw_gateway/g, 'pmos_gateway');
    content = content.replace(/OpenClawGateway/g, 'PmosGateway');
    content = content.replace(/OpenClaw Gateway/g, 'PM-OS Gateway');
    content = content.replace(/openClawGateway/g, 'pmosGateway');
    fs.writeFileSync(filePath, content);
    console.log('Patched', filePath);
}

replaceInFile(indexTs);
replaceInFile(configFieldsTsx);

// Now patch ui/src/adapters/registry.ts
const registryTs = '/home/agdis/Desktop/nova-era-work/nova-era/paperclip/ui/src/adapters/registry.ts';
let registryContent = fs.readFileSync(registryTs, 'utf8');

const importStatement = 'import { pmosGatewayUIAdapter } from "./pmos-gateway";';
registryContent = registryContent.replace('import { openClawGatewayUIAdapter } from "./openclaw-gateway";', importStatement + '\nimport { openClawGatewayUIAdapter } from "./openclaw-gateway";');
registryContent = registryContent.replace('openClawGatewayUIAdapter,', 'openClawGatewayUIAdapter,\n    pmosGatewayUIAdapter,');

fs.writeFileSync(registryTs, registryContent);
console.log('Patched', registryTs);
