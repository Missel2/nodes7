'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const filename = process.argv[2];
assert.ok(filename, 'Provide npm pack --dry-run --json output filename');
const artifact = JSON.parse(fs.readFileSync(filename, 'utf8'));
assert.ok(Array.isArray(artifact) && artifact.length === 1, 'Expect exactly one package');
const pkg = artifact[0];
assert.equal(pkg.name, '@st-one-io/nodes7', 'Inherited package identity must not change in bootstrap');
assert.equal(pkg.version, '1.1.2');
const files = new Set(pkg.files.map(entry => entry.path));
for (const required of ['LICENSE', 'README.md', 'src/index.js', 'src/s7endpoint.js', 'src/s7connection.js']) {
  assert.ok(files.has(required), 'Missing mandatory distribution file: ' + required);
}
assert.ok(![...files].some(p => p.includes('node_modules/') || p === '.env'), 'Unexpected dependency or secret in package');
console.log('Dry-run package manifest verified: ' + files.size + ' files, no publication.');
