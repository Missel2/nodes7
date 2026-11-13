'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {verifyPackage} = require('../ci/check-package.cjs');
const NAME = '@missel2/nodes7';
const VERSION = '0.1.0-alpha.2';
const HASH = '11327c208ad99dae5eca2fd4a6fd9a83e17637b8eb4ad1f2018c6ba98bd6c81e';
const REQUIRED = [
  'Syntax and negative control (ubuntu-24.04, Node 22)',
  'Syntax and negative control (ubuntu-24.04, Node 24)',
  'Syntax and negative control (windows-2025, Node 22)',
  'Syntax and negative control (windows-2025, Node 24)',
  'Upstream unit baseline (ubuntu-24.04, Node 22)',
  'Upstream unit baseline (windows-2025, Node 22)',
  'Package baseline (Ubuntu, Node 22)',
  'Analyze (javascript-typescript)',
  'COTP source original-red and candidate-green (ubuntu-24.04, Node 22)',
  'COTP source original-red and candidate-green (windows-2025, Node 22)',
  'S7Comm loopback protocol and network faults (ubuntu-24.04, Node 22)',
  'S7Comm loopback protocol and network faults (windows-2025, Node 22)',
  'Alpha archive, SBOM and license preflight',
  'Packed alpha consumer (ubuntu-24.04, Node 22)',
  'Packed alpha consumer (windows-2025, Node 22)',
  'Packed archive reproducibility (Ubuntu/Windows, Node 22)'
];
const WORKFLOWS = ['Verification', 'CodeQL', 'Release preflight (no publish)'];

function guardContext(env) {
  assert.equal(env.GITHUB_REPOSITORY, 'Missel2/nodes7', 'WRONG_REPO');
  assert.equal(env.GITHUB_REF, 'refs/heads/master', 'NOT_MASTER');
  assert.equal(env.GITHUB_EVENT_NAME, 'workflow_dispatch', 'NOT_MANUAL');
  assert.match(env.GITHUB_SHA || '', /^[0-9a-f]{40}$/, 'BAD_SHA');
  assert.equal(env.SOURCE_SHA_INPUT, env.GITHUB_SHA, 'SHA_CHANGED');
  assert.equal(env.ARCHIVE_SHA256_INPUT, HASH, 'ARCHIVE_NOT_APPROVED');
  assert.ok(['verify', 'stage'].includes(env.STAGE_OPERATION), 'INVALID_OPERATION');
}
function guardPackage(pkg, lock) {
  assert.equal(pkg.name, NAME);
  assert.equal(pkg.version, VERSION);
  assert.equal(pkg.repository?.url, 'https://github.com/Missel2/nodes7.git');
  assert.equal(pkg.license, 'GPL-3.0-or-later');
  assert.deepEqual(pkg.publishConfig, {access: 'public', tag: 'alpha'});
  assert.deepEqual(pkg.files, ['src/']);
  assert.deepEqual(pkg.dependencies, {'iso-on-tcp': '^0.1.0'});
  assert.equal(lock.name, NAME);
  assert.equal(lock.version, VERSION);
  assert.equal(lock.packages?.['']?.version, VERSION);
  assert.deepEqual(lock.packages?.['']?.dependencies, pkg.dependencies);
  assert.equal(lock.packages?.['node_modules/iso-on-tcp']?.version, '0.1.0');
}
function guardCI(branch, checks, runs, sha) {
  assert.equal(branch.name, 'master');
  assert.equal(branch.protected, true, 'UNPROTECTED_MASTER');
  assert.equal(branch.commit.sha, sha, 'MASTER_MOVED');
  assert.ok(Array.isArray(checks.check_runs));
  assert.equal(checks.total_count, checks.check_runs.length, 'PAGINATED_CHECKS');
  for (const name of REQUIRED) {
    assert.ok(checks.check_runs.some(c => c.name === name &&
      c.head_sha === sha && c.status === 'completed' &&
      c.conclusion === 'success' && c.app?.id === 15368), 'MISSING_GREEN_CHECK:' + name);
  }
  for (const name of WORKFLOWS) {
    assert.ok(runs.workflow_runs.some(w => w.name === name &&
      w.head_sha === sha && w.event === 'push' &&
      w.status === 'completed' && w.conclusion === 'success'),
    'MISSING_GREEN_PUSH_WORKFLOW:' + name);
  }
}
function guardArchive(pack, bytes, sha) {
  verifyPackage(pack);
  assert.match(sha, /^[a-f0-9]{40}$/);
  assert.equal(pack[0].name, NAME);
  assert.equal(pack[0].version, VERSION);
  assert.ok(pack[0].files.some(f => f.path === 'src/s7address.js'));
  const actual = crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(actual, HASH, 'ARCHIVE_BYTES_MISMATCH');
  const integrity = 'sha512-' + crypto.createHash('sha512').update(bytes).digest('base64');
  assert.equal(pack[0].integrity, integrity, 'INTEGRITY_MISMATCH');
  return {sourceCommit:sha,name:NAME,version:VERSION,tag:'alpha',sha256:actual,integrity,mode:'STAGE_NOT_PUBLIC'};
}
async function ghJson(url) {
  assert.ok(process.env.GITHUB_TOKEN, 'MISSING_READ_TOKEN');
  const res = await fetch(url, {headers:{
    Authorization:'Bearer ' + process.env.GITHUB_TOKEN,
    Accept:'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28'
  },signal:AbortSignal.timeout(15000)});
  assert.equal(res.status, 200, 'GITHUB_API_UNAVAILABLE');
  return res.json();
}
async function main() {
  const mode = process.argv[2];
  assert.ok(['source','archive'].includes(mode), 'BAD_MODE');
  guardContext(process.env);
  const sha = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',timeout:10000}).trim();
  assert.equal(sha, process.env.SOURCE_SHA_INPUT, 'WRONG_CHECKOUT');
  guardPackage(JSON.parse(fs.readFileSync('package.json','utf8')),
    JSON.parse(fs.readFileSync('package-lock.json','utf8')));
  if (mode === 'source') {
    const root = 'https://api.github.com/repos/Missel2/nodes7';
    const [branch,checks,runs] = await Promise.all([
      ghJson(root + '/branches/master'),
      ghJson(root + '/commits/' + sha + '/check-runs?per_page=100'),
      ghJson(root + '/actions/runs?head_sha=' + sha + '&per_page=100')]);
    guardCI(branch,checks,runs,sha);
    console.log('NODES7_MANUAL_STAGE_SOURCE_PASS');
    return;
  }
  const folder = path.resolve('stage-evidence');
  const pack = JSON.parse(fs.readFileSync(path.join(folder,'pack.json'),'utf8'));
  assert.equal(pack?.[0]?.filename, 'missel2-nodes7-0.1.0-alpha.2.tgz');
  const archive = path.resolve(folder,pack[0].filename);
  assert.equal(path.dirname(archive), folder);
  const result = guardArchive(pack,fs.readFileSync(archive),sha);
  fs.writeFileSync(path.join(folder,'stage-verified.json'),JSON.stringify(result,null,2) + '\n');
  console.log('NODES7_MANUAL_STAGE_ARCHIVE_PASS');
}
if (require.main === module) main().catch(() => {
  console.error('NODES7_MANUAL_STAGE_GUARD_REJECTED');
  process.exitCode = 1;
});
module.exports = {guardContext,guardPackage,guardCI,guardArchive};
