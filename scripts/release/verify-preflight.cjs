'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {verifyPackage} = require('../ci/check-package.cjs');

const root = path.resolve(__dirname, '../..');
const EXPECTED_NAME = '@missel2/nodes7';
const EXPECTED_VERSION = '0.1.0-alpha.2';

function readJson(filename) {
  return JSON.parse(fs.readFileSync(filename, 'utf8'));
}

function sha(data, algorithm, encoding = 'hex') {
  return crypto.createHash(algorithm).update(data).digest(encoding);
}

function verifyIdentity(pkg, lock) {
  assert.equal(pkg.name, EXPECTED_NAME);
  assert.equal(pkg.version, EXPECTED_VERSION);
  assert.equal(pkg.license, 'GPL-3.0-or-later');
  assert.equal(pkg.main, 'src/index.js');
  assert.deepEqual(pkg.files, ['src/'], 'Only runtime source belongs in npm archive');
  assert.deepEqual(pkg.publishConfig, {access: 'public', tag: 'alpha'});
  assert.deepEqual(pkg.dependencies, {'iso-on-tcp': '^0.1.0'});
  assert.equal(lock.lockfileVersion, 3);
  assert.equal(lock.name, pkg.name);
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].name, pkg.name);
  assert.equal(lock.packages[''].version, pkg.version);
  assert.deepEqual(lock.packages[''].dependencies, pkg.dependencies);
  assert.deepEqual(lock.packages[''].devDependencies, pkg.devDependencies);
  const production = Object.entries(lock.packages).filter(([key, value]) => key && !value.dev);
  assert.deepEqual(
    production.map(([key]) => key),
    ['node_modules/iso-on-tcp'],
    'Production dependency set requires a separate review',
  );
  assert.equal(lock.packages['node_modules/iso-on-tcp'].version, '0.1.0');
}

function verifySbom(spdx, cyclonedx, pkg) {
  assert.match(spdx.spdxVersion || '', /^SPDX-2\./);
  assert.ok(Array.isArray(spdx.packages));
  for (const [name, version] of [[pkg.name, pkg.version], ['iso-on-tcp', '0.1.0']]) {
    assert.ok(spdx.packages.some(item => item.name === name && item.versionInfo === version),
      'Missing SPDX package: ' + name);
  }
  assert.equal(cyclonedx.bomFormat, 'CycloneDX');
  assert.equal(cyclonedx.metadata?.component?.purl, 'pkg:npm/%40missel2/nodes7@0.1.0-alpha.2');
  assert.ok(Array.isArray(cyclonedx.components) &&
    cyclonedx.components.some(item => item.name === 'iso-on-tcp' && item.version === '0.1.0'),
  'Missing CycloneDX production dependency');
}

function main() {
  const folder = path.resolve(process.argv[2] || 'release-evidence');
  const pkg = readJson(path.join(root, 'package.json'));
  const lock = readJson(path.join(root, 'package-lock.json'));
  verifyIdentity(pkg, lock);

  const entries = readJson(path.join(folder, 'pack.json'));
  const files = verifyPackage(entries);
  assert.ok(files >= 8);
  const info = entries[0];
  const archivePath = path.join(folder, info.filename);
  assert.equal(path.dirname(archivePath), folder);
  const bytes = fs.readFileSync(archivePath);
  assert.equal(info.integrity, 'sha512-' + sha(bytes, 'sha512', 'base64'),
    'npm metadata SHA512 integrity mismatch');
  assert.equal(info.shasum, sha(bytes, 'sha1'), 'npm metadata SHA1 checksum mismatch');
  const actualPaths = execFileSync('tar', ['-tzf', archivePath], {
    encoding: 'utf8',
    timeout: 15000,
  }).split(/\r?\n/).filter(Boolean).map(filename => {
    assert.ok(filename.startsWith('package/'), 'Unexpected tarball path');
    return filename.slice('package/'.length);
  }).filter(filename => filename && !filename.endsWith('/')).sort();
  assert.deepEqual(actualPaths, info.files.map(f => f.path).sort(),
    'Archive contents differ from npm pack file manifest');

  const spdxFile = path.join(folder, 'sbom.spdx.json');
  const cyclonedxFile = path.join(folder, 'sbom.cdx.json');
  verifySbom(readJson(spdxFile), readJson(cyclonedxFile), pkg);
  const dep = readJson(path.join(root, 'node_modules/iso-on-tcp/package.json'));
  assert.equal(dep.name, 'iso-on-tcp');
  assert.equal(dep.version, '0.1.0');
  assert.equal(dep.license, 'GPL-3.0-or-later');
  const hasNotice = fs.readdirSync(path.join(root, 'node_modules/iso-on-tcp'))
    .some(filename => /^licen[sc]e(?:\..*)?$/i.test(filename));
  assert.ok(hasNotice, 'Missing upstream runtime dependency license file');

  const sourceCommit = process.env.SOURCE_SHA || '';
  assert.match(sourceCommit, /^[0-9a-f]{40}$/);
  const actualCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root, encoding: 'utf8', timeout: 10000,
  }).trim();
  assert.equal(sourceCommit, actualCommit);

  const result = {
    schemaVersion: 1,
    status: 'preflight-only-not-published',
    sourceCommit,
    package: {
      name: pkg.name,
      version: pkg.version,
      tag: pkg.publishConfig.tag,
      archiveName: info.filename,
      fileCount: info.files.length,
      sha256: sha(bytes, 'sha256'),
      sha512: sha(bytes, 'sha512'),
      integrity: info.integrity,
    },
    inputs: {
      manifestSha256: sha(fs.readFileSync(path.join(root, 'package.json')), 'sha256'),
      lockSha256: sha(fs.readFileSync(path.join(root, 'package-lock.json')), 'sha256'),
    },
    sbom: {
      source: 'production-lockfile-derived',
      spdxSha256: sha(fs.readFileSync(spdxFile), 'sha256'),
      cyclonedxSha256: sha(fs.readFileSync(cyclonedxFile), 'sha256'),
    },
    runtimeDependency: {
      name: dep.name, version: dep.version, declaredLicense: dep.license,
      licenseFilePresent: hasNotice,
    },
    gates: {
      publication: 'not-authorized',
      legalReview: 'manual',
      releaseArtifactReview: 'manual',
      physicalHardware: 'not-tested',
    },
  };
  fs.writeFileSync(path.join(folder, 'manifest.json'), JSON.stringify(result, null, 2) + '\n');
  console.log('NODES7_RELEASE_PREFLIGHT_PASS');
  console.log('NODES7_SOURCE_COMMIT=' + sourceCommit);
  console.log('NODES7_ARCHIVE_SHA256=' + result.package.sha256);
  console.log('NODES7_PUBLISH_STATUS=not-published');
}

if (require.main === module) main();

module.exports = {verifyIdentity, verifySbom};
