'use strict';
// Temporary CodeQL diagnostic for a reported high-severity PR alert.
// This prints rule id/location/brief message, not the entire sensitive trace.
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2];
if (!root || !fs.existsSync(root)) throw new Error('CodeQL SARIF output directory not found: ' + root);
function walk(dir) {
    return fs.readdirSync(dir, {withFileTypes: true}).flatMap(item => {
        const name = path.join(dir, item.name);
        return item.isDirectory() ? walk(name) : (name.endsWith('.sarif') ? [name] : []);
    });
}
const files = walk(root);
if (!files.length) throw new Error('No SARIF files found in CodeQL output');
let total = 0;
for (const file of files) {
    const sarif = JSON.parse(fs.readFileSync(file,'utf8'));
    for (const run of sarif.runs || []) {
        const definitions = new Map((run.tool?.driver?.rules || []).map(item=>[item.id,item]));
        for (const result of run.results || []) {
            if (++total > 30) { console.log('Truncated findings after first 30.'); break; }
            const rule = definitions.get(result.ruleId)||{};
            const location = result.locations?.[0]?.physicalLocation||{};
            const data = {
                id: result.ruleId,
                message: result.message?.text?.slice(0,400),
                severity: rule.properties?.securitySeverity||rule.properties?.precision||result.level,
                path: location.artifactLocation?.uri,
                line: location.region?.startLine
            };
            console.log('CODEQL_FINDING '+JSON.stringify(data));
        }
    }
}
console.log('CODEQL_TOTAL_'+total);
