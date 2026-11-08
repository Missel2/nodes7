'use strict';
// Actual classic S7Comm over loopback TCP, not a stubbed Node-RED/nodes7 transport.
// HIL-S7-001/-002/-003: pending authorized physical S7-1200 verification.
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { S7Endpoint, S7ItemGroup } = require('../../src/index.js');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'test-reports');
const PORT = 1102;

function deadline(ms, description) {
    return new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new Error(description + ' timed out after ' + ms + 'ms')), ms);
        timer.unref();
    });
}

async function spawnFixture() {
    const python = process.env.S7_FIXTURE_PYTHON || 'python';
    const child = spawn(python, ['-u', path.join(__dirname, 'fixture_server.py')], {
        cwd: ROOT, env: { ...process.env, PYTHONUNBUFFERED: '1' }, stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    const ready = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('S7 fixture did not become ready: ' + stderr + stdout)), 10000);
        const accept = () => {
            if (stdout.includes('S7_WIRE_FIXTURE_READY')) {
                clearTimeout(timer);
                resolve();
            }
        };
        child.stdout.on('data', chunk => {
            stdout = (stdout + chunk.toString()).slice(-60000);
            accept();
        });
        child.stderr.on('data', chunk => {
            stderr = (stderr + chunk.toString()).slice(-60000);
        });
        child.once('error', error => {
            clearTimeout(timer);
            reject(error);
        });
        child.once('exit', (code, signal) => {
            clearTimeout(timer);
            reject(new Error('S7 fixture exited early: ' + code + ' / ' + signal + ': ' + stderr + stdout));
        });
    });
    const fixture = {
        child,
        logs: () => ({ stdout, stderr }),
        async stop() {
            if (child.exitCode === null) {
                child.kill();
                await Promise.race([
                    new Promise(resolve => child.once('exit', resolve)),
                    new Promise(resolve => setTimeout(resolve, 2500))
                ]);
                if (child.exitCode === null) child.kill('SIGKILL');
            }
        }
    };
    try {
        await ready;
        return fixture;
    } catch (error) {
        await fixture.stop();
        throw error;
    }
}

function connected(endpoint) {
    if (endpoint.isConnected) return Promise.resolve();
    return new Promise((resolve, reject) => {
        function cleanup() {
            endpoint.removeListener('connect', onConnect);
            endpoint.removeListener('error', onError);
        }
        function onConnect() { cleanup(); resolve(); }
        function onError(err) { cleanup(); reject(err); }
        endpoint.on('connect', onConnect);
        endpoint.on('error', onError);
    });
}

test('actual nodes7 S7Comm connects, reads and writes synthetic DB1', { timeout: 25000 }, async t => {
    fs.mkdirSync(OUT, { recursive: true });
    const evidence = {
        fixture: 'python-snap7==3.3.1',
        dependency: 'Missel2/nodes7 candidate source (no published fork release)',
        communication: 'actual COTP/S7Comm over TCP loopback',
        hardware: false, checks: []
    };
    const fixture = await spawnFixture();
    t.after(async () => {
        await fixture.stop();
        fs.writeFileSync(path.join(OUT, 's7-fixture.log'), [
            'STDOUT:', fixture.logs().stdout, 'STDERR:', fixture.logs().stderr
        ].join('\n'), 'utf8');
        fs.writeFileSync(path.join(OUT, 's7-wire-evidence.json'),
            JSON.stringify(evidence, null, 2) + '\n', 'utf8');
    });

    const endpoint = new S7Endpoint({
        host: '127.0.0.1', port: PORT, rack: 0, slot: 1,
        autoReconnect: 5000, s7ConnOpts: { timeout: 2000 }
    });
    const errors = [];
    endpoint.on('error', error => errors.push(String(error)));
    t.after(async () => {
        try {
            await Promise.race([endpoint.disconnect(), deadline(4000, 'S7 disconnect')]);
        } catch (error) {
            evidence.disconnectError = String(error);
        }
    });

    await Promise.race([connected(endpoint), deadline(9000, 'real S7 handshake')]);
    assert.equal(endpoint.isConnected, true);
    evidence.checks.push('real ISO-on-TCP/COTP and S7 setup');

    const addresses = {
        temperature: 'DB1,REAL0',
        counter: 'DB1,INT4',
        writable: 'DB1,REAL8'
    };
    const group = new S7ItemGroup(endpoint);
    group.setTranslationCB(name => addresses[name]);
    group.addItems(Object.keys(addresses));

    const before = await Promise.race([
        group.readAllItems(), deadline(5000, 'real S7 READ_VAR')
    ]);
    assert.equal(before.temperature, 12.5);
    assert.equal(before.counter, -123);
    assert.equal(before.writable, 3.25);
    evidence.checks.push('S7 READ_VAR: REAL and INT from synthetic DB1');

    await Promise.race([
        group.writeItems('writable', 19.75), deadline(5000, 'real S7 WRITE_VAR')
    ]);
    const after = await Promise.race([
        group.readAllItems(), deadline(5000, 'S7 readback after write')
    ]);
    assert.equal(after.temperature, 12.5, 'unrelated bytes remain unchanged');
    assert.equal(after.counter, -123, 'unrelated INT bytes remain unchanged');
    assert.equal(after.writable, 19.75, 'actual protocol write must persist');
    evidence.checks.push('S7 WRITE_VAR: synthetic DB1 REAL8 and READ_VAR readback');

    assert.deepEqual(errors, [], 'healthy wire roundtrip must not emit endpoint errors');
    await Promise.race([endpoint.disconnect(), deadline(4000, 'healthy S7 disconnect')]);
    assert.equal(endpoint.isConnected, false, 'clean session disconnect must complete');
    evidence.checks.push('clean nodes7 endpoint.disconnect');
});
