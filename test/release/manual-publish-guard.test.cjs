'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {guardContext,guardPackage,guardCI,guardArchive} =
  require('../../scripts/release/manual-publish-guard.cjs');
const SHA = 'c8b6e9e9dc48e240166527cb2e08410eebad5cf7';
const HASH = '11327c208ad99dae5eca2fd4a6fd9a83e17637b8eb4ad1f2018c6ba98bd6c81e';

function context() {
  return {GITHUB_REPOSITORY:'Missel2/nodes7',
    GITHUB_REF:'refs/heads/master',GITHUB_EVENT_NAME:'workflow_dispatch',
    GITHUB_SHA:SHA,SOURCE_SHA_INPUT:SHA,ARCHIVE_SHA256_INPUT:HASH,
    RELEASE_OPERATION:'verify'};
}
function fixture() {
  const pkg={name:'@missel2/nodes7',version:'0.1.0-alpha.2',
    repository:{url:'https://github.com/Missel2/nodes7.git'},
    license:'GPL-3.0-or-later',files:['src/'],
    publishConfig:{access:'public',tag:'alpha'},dependencies:{'iso-on-tcp':'^0.1.0'}};
  return {pkg,lock:{name:pkg.name,version:pkg.version,packages:{
    '':{version:pkg.version,dependencies:pkg.dependencies},
    'node_modules/iso-on-tcp':{version:'0.1.0'}}}};
}
test('manual GitHub public publish requires exact repo, master, source and archive, and operation',()=>{
  assert.doesNotThrow(()=>guardContext(context()));
  assert.doesNotThrow(()=>guardContext({...context(),RELEASE_OPERATION:'publish'}));
  for(const [key,value] of [
    ['GITHUB_REPOSITORY','wrong/nodes7'],
    ['GITHUB_REF','refs/heads/feature'],
    ['GITHUB_EVENT_NAME','push'],
    ['GITHUB_SHA','0'.repeat(40)],
    ['SOURCE_SHA_INPUT','a'.repeat(40)],
    ['ARCHIVE_SHA256_INPUT','0'.repeat(64)],
    ['RELEASE_OPERATION','stage']
  ]) assert.throws(()=>guardContext({...context(),[key]:value}),
    key+' intentionally invalid must reject');
});
test('immutable alpha identity rejects wrong version, tag, repository and dependency',()=>{
  const {pkg,lock}=fixture();
  assert.doesNotThrow(()=>guardPackage(pkg,lock));
  assert.throws(()=>guardPackage({...pkg,version:'0.1.0-alpha.1'},lock));
  assert.throws(()=>guardPackage({...pkg,publishConfig:{access:'public',tag:'latest'}},lock));
  assert.throws(()=>guardPackage({...pkg,repository:{url:'https://example.invalid'}},lock));
  assert.throws(()=>guardPackage(pkg,{...lock,packages:{...lock.packages,
    'node_modules/iso-on-tcp':{version:'1.0.0'}}}));
});
test('required post-merge push CI blocks missing, failed, unprotected or stale evidence',()=>{
  const branch={name:'master',protected:true,commit:{sha:SHA}};
  const checks={total_count:16,check_runs:[
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
  ].map(name=>({name,head_sha:SHA,status:'completed',conclusion:'success',app:{id:15368}}))};
  const runs={workflow_runs:['Verification','CodeQL','Release preflight (no publish)']
    .map(name=>({name,head_sha:SHA,event:'push',status:'completed',conclusion:'success'}))};
  assert.doesNotThrow(()=>guardCI(branch,checks,runs,SHA));
  assert.throws(()=>guardCI({...branch,protected:false},checks,runs,SHA));
  assert.throws(()=>guardCI({...branch,commit:{sha:'a'.repeat(40)}},checks,runs,SHA));
  assert.throws(()=>guardCI(branch,{...checks,check_runs:checks.check_runs.slice(1)},runs,SHA));
  assert.throws(()=>guardCI(branch,{...checks,check_runs:checks.check_runs
    .map((x,i)=>i===0?{...x,conclusion:'failure'}:x)},runs,SHA));
  assert.throws(()=>guardCI(branch,checks,{workflow_runs:runs.workflow_runs.slice(1)},SHA));
  assert.throws(()=>guardCI(branch,checks,{workflow_runs:runs.workflow_runs
    .map((x,i)=>i===0?{...x,event:'pull_request'}:x)},SHA));
});
test('arbitrary archive bytes are rejected before publication',()=>{
  const files=['LICENSE','README.md','package.json','src/index.js',
    'src/s7endpoint.js','src/s7connection.js','src/s7item.js',
    'src/s7itemGroup.js','src/s7address.js'].map(path=>({path}));
  const pack=[{name:'@missel2/nodes7',version:'0.1.0-alpha.2',
    filename:'missel2-nodes7-0.1.0-alpha.2.tgz',files,integrity:'sha512-fake'}];
  assert.throws(()=>guardArchive(pack,Buffer.from('wrong bytes'),SHA),/ARCHIVE_BYTES_MISMATCH/);
});
test('manual publish workflow never triggers without a deliberate dispatch',()=>{
  const wf=fs.readFileSync('.github/workflows/npm-publish-manual.yml','utf8');
  assert.match(wf,/^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(wf,/^  (?:push|pull_request|schedule|release):/m);
  assert.match(wf,/default: verify/);
  assert.match(wf,/options: \[verify, publish\]/);
  assert.match(wf,/if: inputs.operation == 'publish'/);
  assert.match(wf,/environment: npm-release/);
  assert.equal((wf.match(/id-token: write/g)||[]).length,1);
  assert.doesNotMatch(wf.slice(0,wf.indexOf('\n  publish:\n')),/id-token: write/);
  assert.match(wf,/npm publish publish-evidence\/missel2-nodes7-0\.1\.0-alpha\.2\.tgz/);
  assert.match(wf,/--tag=alpha --access=public --provenance/);
  assert.doesNotMatch(wf,/^\s*npm (?:stage publish|stage approve|dist-tag)\b/m);
  assert.match(wf,/cancel-in-progress: false/);
});
test('release inputs are self-derived and SHA/digest pinned, not manually typed',()=>{
  const wf=fs.readFileSync('.github/workflows/npm-publish-manual.yml','utf8');
  assert.doesNotMatch(wf,/^\s*source_sha:\s*$/m);
  assert.doesNotMatch(wf,/^\s*archive_sha256:\s*$/m);
  assert.match(wf,/SOURCE_SHA_INPUT: \$\{\{ github\.sha \}\}/);
  assert.match(wf,/ARCHIVE_SHA256_INPUT: '11327c208ad99dae5eca2fd4a6fd9a83e17637b8eb4ad1f2018c6ba98bd6c81e'/);
  assert.equal(fs.existsSync('.github/workflows/npm-stage-manual.yml'),false,
    'Do not leave a parallel older staging workflow available');
});
