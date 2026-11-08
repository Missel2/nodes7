'use strict';

const assert = require('node:assert/strict');
const manifest = require('../../package.json');
const committedLock = require('../../package-lock.json');

function validate(manifestData, lock) {
  assert.equal(lock.lockfileVersion, 3, 'Expected npm lockfile format v3');
  assert.equal(lock.name, manifestData.name, 'Mismatch: root package name');
  assert.equal(lock.version, manifestData.version, 'Mismatch: root version');
  const root = lock.packages?.[''];
  assert.ok(root && typeof root === 'object', 'Missing lockfile root package');
  assert.equal(root.name, manifestData.name, 'Mismatch: locked root package name');
  assert.equal(root.version, manifestData.version, 'Mismatch: locked root package version');
  assert.deepStrictEqual(root.dependencies ?? {}, manifestData.dependencies ?? {},
    'Mismatch: locked root dependencies');
  assert.deepStrictEqual(root.devDependencies ?? {}, manifestData.devDependencies ?? {},
    'Mismatch: locked root development dependencies');

  const packages = lock.packages;
  for (const name of Object.keys({ ...manifestData.dependencies, ...manifestData.devDependencies })) {
    assert.ok(packages['node_modules/' + name],
      'Missing direct dependency entry: ' + name);
  }

  let checked = 0;
  let legacySha1 = 0;
  for (const [name, pkg] of Object.entries(packages)) {
    if (!name) continue;
    assert.ok(!pkg.link, 'Unexpected symlink dependency in inherited package tree: ' + name);
    assert.equal(typeof pkg.version, 'string', 'Missing resolved dependency version: ' + name);
    assert.equal(typeof pkg.resolved, 'string', 'Missing resolved registry URL: ' + name);
    assert.ok(pkg.resolved.startsWith('https://registry.npmjs.org/'),
      'Unapproved dependency registry URL: ' + name + ': ' + pkg.resolved);
    assert.equal(typeof pkg.integrity, 'string', 'Missing integrity: ' + name);
    assert.match(pkg.integrity,
      /^(?:sha512|sha384|sha256|sha1)-[A-Za-z0-9+/]+={0,2}$/,
      'Malformed Subresource Integrity metadata: ' + name);
    if (pkg.integrity.startsWith('sha1-')) legacySha1++;
    checked++;
  }

  assert.ok(checked >= 250, 'Unexpected dependency tree shrink: ' + checked);
  // Explicitly freeze the classic S7 runtime transport version until separately reviewed.
  assert.equal(packages['node_modules/iso-on-tcp'].version, '0.1.0',
    'Unexpected transport dependency version');
  return { packages: checked, legacySha1 };
}

const actual = validate(manifest, committedLock);

if (process.argv.includes('--negative-control')) {
  const examples = [
    { name: 'root version mismatch', edit: l => { l.version = '1.1.0'; }, match: /Mismatch: root version/ },
    { name: 'dependency manifest mismatch', edit: l => {
      l.packages[''].dependencies['iso-on-tcp'] = '^999.0.0';
    }, match: /Mismatch: locked root dependencies/ },
    { name: 'missing resolved direct dependency', edit: l => {
      delete l.packages['node_modules/iso-on-tcp'];
    }, match: /Missing direct dependency entry/ },
    { name: 'missing integrity', edit: l => {
      delete l.packages['node_modules/iso-on-tcp'].integrity;
    }, match: /Missing integrity/ },
    { name: 'untrusted registry', edit: l => {
      l.packages['node_modules/iso-on-tcp'].resolved = 'https://example.invalid/iso-on-tcp.tgz';
    }, match: /Unapproved dependency registry URL/ },
    { name: 'invalid integrity', edit: l => {
      l.packages['node_modules/iso-on-tcp'].integrity = 'sha512-???';
    }, match: /Malformed Subresource Integrity/ },
    { name: 'wrong format', edit: l => { l.lockfileVersion = 1; }, match: /Expected npm lockfile format v3/ }
  ];
  for (const example of examples) {
    const mutated = structuredClone(committedLock);
    example.edit(mutated);
    assert.throws(() => validate(manifest, mutated), example.match,
      'Intentionally broken lockfile unexpectedly passed: ' + example.name);
  }
  console.log('Negative controls: ' + examples.length + '/7 intentional lockfile errors rejected.');
} else {
  console.log('Validated ' + actual.packages + ' locked packages with registry integrity.');
  console.log('Inherited SHA-1 integrity entries: ' + actual.legacySha1 + ' (explicitly tracked technical debt).');
  console.log('A valid integrity string is NOT proof of a vulnerability-free dependency.');
}
