'use strict';
// Real nodes7 S7Comm, no mocked endpoint and no physical Siemens PLC.
// HIL-S7-001/-002/-005: PENDING_HARDWARE.
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { S7Endpoint, S7ItemGroup } = require('../../src/index.js');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'test-reports');
const PORT = 1103; // 1102 used by the concurrent roundtrip test
const PYTHON = process.env.S7_FIXTURE_PYTHON || 'python';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function expectEventually(endpoint, eventName, wanted, milliseconds) {
    if (endpoint.isConnected === wanted) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => finish(new Error(
            'nodes7 did not become ' + (wanted ? 'connected' : 'disconnected') + ' in ' + milliseconds + 'ms'
        )), milliseconds);
        function finish(error) {
            clearTimeout(timer);
            endpoint.removeListener(eventName, update);
            if (error) reject(error);
            else resolve();
        }
        function update() {
            if (endpoint.isConnected === wanted) finish();
        }
        endpoint.on(eventName, update);
        update();
    });
}

async function startServer() {
    const child = spawn(PYTHON, ['-u', path.join(__dirname, 'fixture_server.py')], {
        cwd: ROOT,
        env: { ...process.env, S7_FIXTURE_PORT: String(PORT), PYTHONUNBUFFERED: '1' },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '', errors = '';
    let exited = false;
    const exitPromise = new Promise(resolve => child.once('exit', (code, signal) => {
        exited = true;
        resolve({ code, signal });
    }));
    const server = {
        log: () => ({ stdout: output.slice(-12000), stderr: errors.slice(-12000) }),
        async stop() {
            if (exited) return;
            child.kill('SIGTERM');
            await Promise.race([exitPromise, sleep(5000)]);
            if (!exited) {
                child.kill('SIGKILL');
                await Promise.race([exitPromise, sleep(1500)]);
            }
            assert.equal(exited, true, 'disposable S7 server must terminate');
        }
    };
    try {
        await new Promise((resolve, reject) => {
            const timer = setTimeout(
                () => reject(new Error('S7 restart fixture startup timed out: ' + errors + output)),
                10000
            );
            child.stdout.on('data', data => {
                output = (output + data.toString()).slice(-16000);
                if (output.includes('S7_WIRE_FIXTURE_READY')) {
                    clearTimeout(timer);
                    resolve();
                }
            });
            child.stderr.on('data', data => {
                errors = (errors + data.toString()).slice(-16000);
            });
            child.once('error', error => {
                clearTimeout(timer);
                reject(error);
            });
            child.once('exit', (code, signal) => {
                clearTimeout(timer);
                reject(new Error('S7 restart fixture died early: ' + code + '/' + signal + ' ' + errors + output));
            });
        });
        return server;
    } catch (error) {
        try { await server.stop(); } catch (_ignored) {}
        throw error;
    }
}

async function limit(promise, ms, label) {
    let timer;
    try {
        return await Promise.race([
            promise,
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error(label + ' exceeded ' + ms + 'ms')), ms);
            })
        ]);
    } finally {
        clearTimeout(timer);
    }
}

test('real S7Comm endpoint reconnects through two software server restarts', { timeout: 65000 }, async t => {
    fs.mkdirSync(OUT, { recursive: true });
    const evidence = {
        client: 'Missel2/nodes7 candidate source (no published fork release)',
        server: 'python-snap7==3.3.1',
        environment: 'loopback synthetic DB1',
        hardware: false,
        cycles: [], connectionEvents: 0, disconnectEvents: 0, errors: []
    };
    const servers = [];
    let activeServer;
    let endpoint;

    t.after(async () => {
        if (endpoint) {
            try { await limit(endpoint.disconnect(), 4000, 'final nodes7 disconnect'); }
            catch (error) { evidence.cleanupError = String(error); }
        }
        if (activeServer) {
            try { await activeServer.stop(); }
            catch (error) { evidence.fixtureStopError = String(error); }
        }
        fs.writeFileSync(path.join(OUT, 's7-restart-evidence.json'),
            JSON.stringify(evidence, null, 2) + '\n');
        fs.writeFileSync(path.join(OUT, 's7-restart-fixture.log'),
            servers.map((server, i) =>
                '--- instance ' + (i + 1) + ' ---\n' + JSON.stringify(server.log())).join('\n'));
    });

    activeServer = await startServer();
    servers.push(activeServer);
    endpoint = new S7Endpoint({
        host: '127.0.0.1', port: PORT, rack: 0, slot: 1,
        autoReconnect: 300, s7ConnOpts: { timeout: 1600 }
    });
    endpoint.on('connect', () => evidence.connectionEvents++);
    endpoint.on('disconnect', () => evidence.disconnectEvents++);
    endpoint.on('error', error => {
        if (evidence.errors.length < 64) evidence.errors.push(String(error));
    });
    await expectEventually(endpoint, 'connect', true, 9000);

    const group = new S7ItemGroup(endpoint);
    group.setTranslationCB(name => ({
        temperature: 'DB1,REAL0', writable: 'DB1,REAL8'
    })[name]);
    group.addItems(['temperature', 'writable']);

    for (let cycle = 1; cycle <= 2; cycle++) {
        const before = await limit(group.readAllItems(), 5000, 'S7 read before restart');
        assert.equal(before.temperature, 12.5);
        assert.equal(before.writable, 3.25, 'fresh server starts from reset DB');
        const scratch = 8.25 + cycle;
        await limit(group.writeItems('writable', scratch), 5000, 'synthetic write');
        const edited = await limit(group.readAllItems(), 5000, 'synthetic readback');
        assert.equal(edited.writable, scratch);

        await activeServer.stop();
        activeServer = null;
        await expectEventually(endpoint, 'disconnect', false, 8000);
        assert.equal(endpoint.isConnected, false, 'actual S7 connection must be lost');

        // Allow the *real* nodes7 retry loop to encounter a refused TCP port.
        // A fixed observation window avoids a false pass caused by restarting
        // the fixture before any reconnect attempt is made.
        const refusalsAtDisconnect = evidence.errors.filter(error => error.includes('ECONNREFUSED')).length;
        await sleep(1600);
        assert.equal(endpoint.isConnected, false,
            'client must not report connected while its S7 server is stopped');
        const failuresDuringDowntime =
            evidence.errors.filter(error => error.includes('ECONNREFUSED')).length - refusalsAtDisconnect;
        assert.ok(failuresDuringDowntime >= 1,
            'at least one actual ECONNREFUSED must be surfaced while the server is stopped');

        activeServer = await startServer();
        servers.push(activeServer);
        await expectEventually(endpoint, 'connect', true, 12000);
        const after = await limit(group.readAllItems(), 5000, 'S7 read after restart');
        assert.equal(after.temperature, 12.5);
        assert.equal(after.writable, 3.25,
            'restarted server DB must be read, not an obsolete cached value');
        evidence.cycles.push({
            index: cycle, disconnected: true, reconnected: true,
            priorScratchValue: scratch, resetValueObserved: after.writable,
            failuresDuringDowntime
        });
    }
    assert.equal(evidence.cycles.length, 2);
    assert.ok(evidence.connectionEvents >= 3, 'initial and two reconnects observed');
    assert.ok(evidence.disconnectEvents >= 2, 'both server stops observed');
});
