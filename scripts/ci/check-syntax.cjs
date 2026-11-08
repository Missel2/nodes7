'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

function collect(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return collect(full);
    return entry.isFile() && /\.(?:js|cjs|mjs)$/.test(entry.name) ? [full] : [];
  });
}
const files = ['legacy.js', ...collect('src'), ...collect('test'), ...collect('scripts/ci')].sort();
if (files.length < 10) throw new Error('Unexpectedly few JS sources; check enumeration');

function check(filename) {
  return spawnSync(process.execPath, ['--check', filename], {encoding: 'utf8', timeout: 15000});
}

for (const filename of files) {
  const result = check(filename);
  if (result.error || result.status !== 0) {
    throw new Error('Syntax check failed: ' + filename + '\n' + (result.stderr || result.error));
  }
}

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'nodes7-syntax-negative-'));
try {
  const broken = path.join(temporary, 'must-fail.cjs');
  fs.writeFileSync(broken, 'function invalid( {\n', 'utf8');
  const result = check(broken);
  if (result.error || result.status === 0 || !result.stderr.includes('SyntaxError')) {
    throw new Error('Negative control did not reject intentionally invalid JavaScript');
  }
} finally {
  fs.rmSync(temporary, {recursive: true, force: true});
}
console.log('Verified ' + files.length + ' JS files; invalid-syntax negative control rejected as expected.');
