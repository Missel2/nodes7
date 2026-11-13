'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const requiredFiles = [
  'LICENSE', 'README.md', 'package.json',
  'src/index.js', 'src/s7endpoint.js', 'src/s7connection.js',
  'src/s7item.js', 'src/s7itemGroup.js', 'src/s7address.js',
];

function verifyPackage(packs) {
  assert.ok(Array.isArray(packs) && packs.length === 1, 'Expected exactly one npm archive');
  const pkg = packs[0];
  assert.equal(pkg.name, '@missel2/nodes7', 'Unexpected package scope');
  assert.equal(pkg.version, '0.1.0-alpha.2', 'Unexpected alpha version');
  assert.equal(pkg.filename, 'missel2-nodes7-0.1.0-alpha.2.tgz');
  assert.ok(Array.isArray(pkg.files), 'Missing archive file manifest');
  const paths = pkg.files.map(entry => entry.path);
  assert.equal(new Set(paths).size, paths.length, 'Duplicate package file');
  for (const entry of paths) {
    assert.ok(
      ['LICENSE', 'README.md', 'package.json'].includes(entry)
        || entry.startsWith('src/'),
      'Unexpected file in release archive: ' + entry,
    );
    assert.ok(!entry.includes('..') && !entry.includes('\\'), 'Unsafe archive path');
  }
  for (const filename of requiredFiles) {
    assert.ok(paths.includes(filename), 'Missing mandatory distribution file: ' + filename);
  }
  return paths.length;
}

const filename = process.argv[2];
if (require.main === module) {
  assert.ok(filename, 'Provide npm pack --json output filename');
  const packs = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const count = verifyPackage(packs);
  console.log('Independent alpha package manifest verified: ' + count + ' files; unpublished.');
}

module.exports = {verifyPackage};
