'use strict';
// Issue #20: same real-COTP cancellation assertion on immutable old code and this PR.
// An expected-red run proves a defect, never a successful library behavior.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const reports = path.join(root, 'test-reports');
const archived = path.join(reports, 'n7-020-retry-red-green');
const temp = path.join(root, 'src', '.n7-020-original-s7endpoint.cjs');
const baseline = '2cf864e38be447c2709348a25eb0524d67f5cf2d';
const testFile = 'test/network/cotp-lifecycle-extra.test.cjs';
const reportName = 'n7-cotp-cancel-scheduled-retry.json';
fs.mkdirSync(archived, {recursive: true});

const git = spawnSync('git', ['show', baseline + ':src/s7endpoint.js'], {
    cwd: root, encoding: 'utf8', timeout: 15000
});
if (git.error || git.status !== 0 ||
    !git.stdout.includes('class S7Endpoint extends EventEmitter')) {
    throw new Error('Cannot retrieve immutable regression baseline: ' + (git.stderr || git.error));
}

function run(label, source) {
    const result = spawnSync(process.execPath, [
        '--test', '--test-reporter=tap',
        '--test-name-pattern=manual disconnect cancels', testFile
    ], {
        cwd: root, encoding: 'utf8', timeout: 30000,
        env: {...process.env, N7_ENDPOINT_SOURCE: source}
    });
    const log = (result.stdout || '') + '\n' + (result.stderr || '');
    fs.writeFileSync(path.join(archived, label + '.tap'), log);
    if (result.error) throw result.error;
    const json = JSON.parse(fs.readFileSync(path.join(reports, reportName), 'utf8'));
    fs.renameSync(path.join(reports, reportName), path.join(archived, label + '.json'));
    if (json.hardware !== false || json.retryMs !== 1000 ||
        json.case !== 'manual COTP disconnect cancels auto reconnect' ||
        !Array.isArray(json.errors) || json.errors.length !== 0) {
        throw new Error(label + ': invalid or contaminated TCP evidence');
    }
    return {status:result.status, log, json};
}

let original;
let created = false;
try {
    // Exclusive creation avoids replacing another file or check-then-create races.
    fs.writeFileSync(temp, git.stdout, {flag:'wx', mode:0o600, encoding:'utf8'});
    created = true;
    original = run('original-expected-red', '../../src/.n7-020-original-s7endpoint.cjs');
} finally {
    if (created) fs.rmSync(temp, {force:true});
}
if (original.status !== 1 ||
    !/not ok \d+ - manual disconnect cancels the scheduled COTP retry/.test(original.log) ||
    !original.log.includes('N7_NO_RETRY_AFTER_DISCONNECT') ||
    !/# fail 1\b/.test(original.log) ||
    original.log.includes('HARNESS_TIMEOUT') ||
    original.json.attemptsAfterRetryWindow !== 2 ||
    original.json.livePeersBeforeFixtureCleanup !== 1) {
    process.stderr.write(original.log);
    throw new Error('Expected-red source did not reproduce the specific extra TCP retry');
}
process.stdout.write('N7-020 ORIGINAL-RED: 2 attempts, 1 live peer before fixture cleanup.\n');

const candidate = run('candidate-green', '../../src/s7endpoint.js');
if (candidate.status !== 0 ||
    !/ok \d+ - manual disconnect cancels the scheduled COTP retry/.test(candidate.log) ||
    !/# fail 0\b/.test(candidate.log) ||
    candidate.log.includes('HARNESS_TIMEOUT') ||
    candidate.json.attemptsAfterRetryWindow !== 1 ||
    candidate.json.livePeersBeforeFixtureCleanup !== 0) {
    process.stderr.write(candidate.log);
    throw new Error('Candidate did not cancel scheduled COTP retry or clean up its TCP peer');
}
process.stdout.write('N7-020 CANDIDATE-GREEN: 1 attempt, 0 live peers before fixture cleanup.\n');
