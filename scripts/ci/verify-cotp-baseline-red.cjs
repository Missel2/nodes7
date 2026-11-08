'use strict';
// N7-003 test-first negative control: success means our ORIGINAL transport
// demonstrably FAILED the same customer-visible assertions. This runner never
// declares a bug fixed. A patched head later runs the identical test as green.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '../..'), out = path.join(root, 'test-reports');
fs.mkdirSync(out, {recursive: true});
const BASELINE_SHA = 'f201bcc0acdad4742e4066fa084577f23e396ce1';
const temp = path.join(root, 'src', '.n7-003-original-s7endpoint.cjs');
const git = spawnSync('git', ['show', BASELINE_SHA + ':src/s7endpoint.js'], {
    cwd: root, encoding: 'utf8', timeout: 15000
});
if (git.error || git.status !== 0 || !git.stdout.includes('class S7Endpoint extends EventEmitter')) {
    throw new Error('Cannot verify immutable original endpoint source: ' + git.stderr);
}
if (fs.existsSync(temp)) throw new Error('Refuse to overwrite pre-existing baseline source');
let result;
try {
    fs.writeFileSync(temp, git.stdout, 'utf8');
    result = spawnSync(process.execPath,
        ['--test', '--test-reporter=tap', 'test/network/pending-cotp.test.cjs'], {
        cwd: root, encoding: 'utf8', timeout: 40000,
        env: {...process.env, N7_ENDPOINT_SOURCE: '../../src/.n7-003-original-s7endpoint.cjs'}
    });
} finally {
    fs.rmSync(temp, {force: true});
}
const log = (result.stdout || '') + '\n' + (result.stderr || '');
fs.writeFileSync(path.join(out, 'cotp-baseline-expected-red.tap'), log);
if (result.error) throw result.error;
const required = [
    'not ok 1 - early disconnect must settle and close unfinished COTP transport',
    'not ok 2 - watchdog timeout must release blackholed COTP TCP transport',
    'N7_COTP_EARLY_DISCONNECT',
    'N7_COTP_WATCHDOG_PEER',
    '# tests 2',
    '# fail 2'
];
const absent = required.filter(s => !log.includes(s));
if (result.status !== 1 || absent.length ||
    log.includes('HARNESS_TIMEOUT') ||
    !log.includes('AssertionError') ||
    !fs.existsSync(path.join(out, 'cotp-early-disconnect.json')) ||
    !fs.existsSync(path.join(out, 'cotp-watchdog-timeout.json'))) {
    process.stderr.write(log);
    throw new Error('Original-red proof missing or contaminated by harness failure: ' + absent.join(', '));
}
for(const name of ['cotp-early-disconnect.json', 'cotp-watchdog-timeout.json']) {
    const data = JSON.parse(fs.readFileSync(path.join(out, name), 'utf8'));
    if (!data.observedBeforeFixtureCleanup || data.requestBytes < 22 || data.accepted !== 1 ||
        data.hardware !== false || data.peerOpenBeforeFixtureCleanup !== 1) {
        throw new Error('Baseline evidence did not prove 22-byte COTP + open peer before fixture cleanup: '+name);
    }
}
process.stdout.write('BASELINE-RED: confirmed two specific client/peer socket defects on real fork source. NOT FIXED.\n');

const target = path.join(out, 'baseline');
fs.mkdirSync(target, {recursive: true});
for (const name of ['cotp-early-disconnect.json','cotp-watchdog-timeout.json','cotp-baseline-expected-red.tap']) {
    fs.renameSync(path.join(out, name), path.join(target, name));
}
