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

    // N7-029: real S7Comm + COTP frames, not a stubbed requestWriteVar.
    // A 600-byte write exceeds one negotiated WRITE_VAR payload on this peer.
    // Verify every byte, not only that the API promise resolves.
    const largeData = Buffer.from(Array.from(
        { length: 600 }, (_, i) => (i * 79 + 37) & 0xff));
    assert.ok(largeData.length > endpoint.pduSize - 28,
        'the regression must really exercise more than one WRITE_VAR PDU');
    await Promise.race([
        endpoint.writeDB(2, '100', largeData),
        deadline(5000, 'real multi-PDU S7 WRITE_VAR')
    ]);
    const largeReadback = await Promise.race([
        endpoint.readDB(2, 100, largeData.length),
        deadline(5000, 'real multi-PDU S7 READ_VAR readback')
    ]);
    assert.deepEqual(largeReadback, largeData,
        'all chunks of a multi-PDU write must persist exactly');
    const untouchedBefore = await endpoint.readDB(2, 99, 1);
    const untouchedAfter = await endpoint.readDB(2, 700, 1);
    assert.deepEqual(untouchedBefore, Buffer.from([0]),
        'byte immediately before the target area must remain unchanged');
    assert.deepEqual(untouchedAfter, Buffer.from([0]),
        'byte immediately after the target area must remain unchanged');
    evidence.checks.push('N7-029: real S7Comm multi-PDU WRITE_VAR exact 600-byte readback plus sentinel bytes');

    // N7-032: fail closed BEFORE a read or write could reach a real serialized
    // S7Comm peer. The in-memory call observer separately proves zero dispatch.
    // This loopback assertion checks public API errors and healthy follow-up.
    const badRead = endpoint.readDB(2, 2 ** 29, 1);
    await assert.rejects(badRead,
        error => error && error.code === 'ERR_INVALID_ARGUMENT',
        'wrapped read address must be rejected while COTP is connected');
    const mixedRead = [
        { area: 132, db: 2, transport: 2, address: 100, length: 1 },
        { area: 132, db: 2, transport: 2, address: 0x1fffff, length: 2 }
    ];
    await assert.rejects(endpoint.readVars(mixedRead),
        error => error && error.code === 'ERR_INVALID_ARGUMENT',
        'an invalid later READ_VAR item must reject the whole batch');
    const mixedWrite = mixedRead.map(item => ({
        ...item, dataTransport: 4, data: Buffer.from([0x73])
    }));
    await assert.rejects(endpoint.writeVars(mixedWrite),
        error => error && error.code === 'ERR_INVALID_ARGUMENT',
        'an invalid later WRITE_VAR item must reject before any write');
    assert.deepEqual(await endpoint.readDB(2, 100, 3), largeData.subarray(0, 3),
        'the prior correct bytes and connected S7Comm session remain intact');
    evidence.checks.push('N7-032: invalid read/generic mixed write addresses rejected; follow-up S7Comm readback intact');

    assert.deepEqual(errors, [], 'healthy wire roundtrip must not emit endpoint errors');
    await Promise.race([endpoint.disconnect(), deadline(4000, 'healthy S7 disconnect')]);
    assert.equal(endpoint.isConnected, false, 'clean session disconnect must complete');
    evidence.checks.push('clean nodes7 endpoint.disconnect');
});
