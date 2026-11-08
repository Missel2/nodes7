'use strict';
// Positive half of the red/green proof: run the same two test cases against
// this checkout's real source, preserving unmodified original as a red fixture.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '../..'), out = path.join(root, 'test-reports');
fs.mkdirSync(out, {recursive: true});
const result = spawnSync(process.execPath,
    ['--test', '--test-reporter=tap', 'test/network/pending-cotp.test.cjs'], {
    cwd: root, encoding: 'utf8', timeout: 40000,
    env: {...process.env, N7_ENDPOINT_SOURCE: '../../src/s7endpoint.js'}
});
const log = (result.stdout || '') + '\n' + (result.stderr || '');
const target = path.join(out, 'candidate');
fs.mkdirSync(target, {recursive: true});
fs.writeFileSync(path.join(target, 'cotp-candidate-green.tap'), log);
if (result.error) throw result.error;
const required = [
    'ok 1 - early disconnect must settle and close unfinished COTP transport',
    'ok 2 - watchdog timeout must release blackholed COTP TCP transport',
    '# tests 2', '# pass 2', '# fail 0'
];
const absent = required.filter(s => !log.includes(s));
if (result.status !== 0 || absent.length || log.includes('HARNESS_TIMEOUT')) {
    process.stderr.write(log);
    throw new Error('Candidate source not green on exact baseline regression: ' + absent.join(', '));
}
for (const name of ['cotp-early-disconnect.json', 'cotp-watchdog-timeout.json']) {
    const evidencePath = path.join(out, name);
    if (!fs.existsSync(evidencePath)) throw new Error('Missing candidate evidence: '+name);
    const data = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
    if (!data.observedBeforeFixtureCleanup || data.accepted !== 1 ||
        data.requestBytes !== 22 || data.peerOpenBeforeFixtureCleanup !== 0 ||
        data.clientOpenHandlesBeforeFixtureCleanup !== 0 ||
        data.peerClosed.state !== 'fulfilled' || data.connectedEvents !== 0) {
        throw new Error('Candidate TCP cleanup was not proved by actual peer observation: '+name);
    }
    if (name==='cotp-early-disconnect.json' &&
        (data.publicDisconnect.state!=='fulfilled' || data.connectionAttempt.state!=='rejected' ||
         data.connectionAttempt.code!=='ERR_CONNECTION_CLOSED')) {
        throw new Error('Early public connect/disconnect semantics not proved');
    }
    if (name==='cotp-watchdog-timeout.json' &&
        (data.connect.state!=='rejected' || data.connect.code!=='ERR_TIMEOUT' ||
         data.disconnect.state!=='fulfilled')) {
        throw new Error('Native timeout and subsequent public disconnect semantics not proved');
    }
    fs.renameSync(evidencePath, path.join(target, name));
}
process.stdout.write('CANDIDATE-GREEN: two identical tests passed; peer closed before fixture cleanup.\n');
