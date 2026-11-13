'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {verifyPackage} = require('../../scripts/ci/check-package.cjs');
const {verifyIdentity, verifySbom} = require('../../scripts/release/verify-preflight.cjs');

function fixture() {
  const pkg = {
    name: '@missel2/nodes7',
    version: '0.1.0-alpha.2',
    license: 'GPL-3.0-or-later',
    main: 'src/index.js',
    files: ['src/'],
    publishConfig: {access: 'public', tag: 'alpha'},
    dependencies: {'iso-on-tcp': '^0.1.0'},
    devDependencies: {mocha: '^8.1.3'},
  };
  const lock = {
    name: pkg.name, version: pkg.version, lockfileVersion: 3,
    packages: {
      '': {
        name: pkg.name, version: pkg.version,
        dependencies: pkg.dependencies, devDependencies: pkg.devDependencies,
      },
      'node_modules/iso-on-tcp': {version: '0.1.0'},
      'node_modules/mocha': {version: '8.4.0', dev: true},
    },
  };
  const pack = [{
    name: pkg.name, version: pkg.version,
    filename: 'missel2-nodes7-0.1.0-alpha.2.tgz',
    files: [
      'LICENSE', 'README.md', 'package.json',
      'src/index.js', 'src/s7endpoint.js', 'src/s7connection.js',
      'src/s7item.js', 'src/s7itemGroup.js', 'src/s7address.js',
    ].map(path => ({path})),
  }];
  const spdx = {
    spdxVersion: 'SPDX-2.3',
    packages: [
      {name: pkg.name, versionInfo: pkg.version},
      {name: 'iso-on-tcp', versionInfo: '0.1.0'},
    ],
  };
  const cyclonedx = {
    bomFormat: 'CycloneDX',
    metadata: {component: {purl: 'pkg:npm/%40missel2/nodes7@0.1.0-alpha.2'}},
    components: [{name: 'iso-on-tcp', version: '0.1.0'}],
  };
  return {pkg, lock, pack, spdx, cyclonedx};
}

test('accept the standalone alpha identity and archive file boundary', () => {
  const {pkg, lock, pack, spdx, cyclonedx} = fixture();
  assert.doesNotThrow(() => verifyIdentity(pkg, lock));
  assert.doesNotThrow(() => verifyPackage(pack));
  assert.doesNotThrow(() => verifySbom(spdx, cyclonedx, pkg));
});

test('reject upstream scope, latest tag, and unexpectedly expanded production dependencies', () => {
  const {pkg, lock} = fixture();
  assert.throws(() => verifyIdentity({...pkg, name: '@st-one-io/nodes7'}, lock));
  assert.throws(() => verifyIdentity({...pkg, publishConfig: {access: 'public', tag: 'latest'}}, lock));
  assert.throws(() => verifyIdentity(pkg, {
    ...lock,
    packages: {...lock.packages, 'node_modules/rogue': {version: '1.0.0'}},
  }));
});

test('reject accidental CI files, missing runtime and duplicate archive entries', () => {
  const {pack} = fixture();
  assert.throws(() => verifyPackage([{...pack[0], files: [
    ...pack[0].files, {path: '.github/workflows/verification.yml'},
  ]}]));
  assert.throws(() => verifyPackage([{...pack[0], files: pack[0].files.filter(x => x.path !== 'src/index.js')}]));
  assert.throws(() => verifyPackage([{...pack[0], files: pack[0].files.filter(x => x.path !== 'src/s7address.js')}]),
    /Missing mandatory distribution file/, 'S7ANY guard module must be packaged');
  assert.throws(() => verifyPackage([{...pack[0], files: [
    ...pack[0].files, {...pack[0].files[0]},
  ]}]));
});

test('reject incomplete or misidentified software bills of materials', () => {
  const {pkg, spdx, cyclonedx} = fixture();
  assert.throws(() => verifySbom({...spdx, packages: spdx.packages.slice(0, 1)}, cyclonedx, pkg));
  assert.throws(() => verifySbom(spdx, {...cyclonedx, components: []}, pkg));
});

test('reject already published alpha.1 metadata masquerading as next candidate', () => {
  const {pkg, lock, pack, spdx, cyclonedx} = fixture();
  assert.throws(() => verifyIdentity({...pkg, version: '0.1.0-alpha.1'}, lock),
    /0.1.0-alpha.2|Expected values to be strictly equal/);
  assert.throws(() => verifyIdentity(pkg, {...lock, version: '0.1.0-alpha.1'}),
    /0.1.0-alpha.2|Expected values to be strictly equal/);
  assert.throws(() => verifyPackage([{...pack[0],
    filename: 'missel2-nodes7-0.1.0-alpha.1.tgz'}]));
  assert.throws(() => verifySbom(spdx, {
    ...cyclonedx,
    metadata: {component: {purl: 'pkg:npm/%40missel2/nodes7@0.1.0-alpha.1'}},
  }, pkg));
});
