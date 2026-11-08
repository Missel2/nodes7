'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const pkg = require('../../package.json');
const exported = require('../../src/index.js');

test('inherited public exports remain present and callable', () => {
  for (const name of ['S7Parser','S7Serializer','S7Connection','S7Endpoint','S7Item','S7ItemGroup']) {
    assert.equal(typeof exported[name], 'function', 'Missing public export: ' + name);
  }
  assert.equal(typeof exported.s7constants, 'object');
});

test('bootstrap preserves inherited npm identity and GPL declaration', () => {
  assert.equal(pkg.name, '@st-one-io/nodes7');
  assert.equal(pkg.version, '1.1.2');
  assert.equal(pkg.license, 'GPL-3.0-or-later');
  assert.equal(pkg.main, 'src/index.js');
});
