const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if(file.endsWith('.ts') || file.endsWith('.tsx')) {
               results.push(file);
            }
        }
    });
    return results;
}

const pmosDir = '/home/agdev/Desktop/nova-era-work/nova-era/paperclip/packages/adapters/pmos-gateway';
const files = walk(pmosDir);

files.forEach(f => {
   let content = fs.readFileSync(f, 'utf8');
   content = content.replace(/PM-OSGateway/g, 'PmosGateway');
   content = content.replace(/PM-OS Gateway/g, 'PM-OS Gateway');
   content = content.replace(/PM-OS/g, 'Pmos');
   fs.writeFileSync(f, content);
});
console.log('Fixed identifiers');
