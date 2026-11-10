'use strict';
// Public command vs external state: real COTP and disposable synthetic S7Comm.
// HIL-S7-001/002/005/007: PENDING_HARDWARE, no real PLC or physical I/O.
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const {spawn} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const {S7Endpoint, S7ItemGroup} = require('../../src/index.js');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'test-reports');
const PORT = 1104; // other concurrently run protocol cases use 1102/1103
const RETRY_MS = 2500;
const PYTHON = process.env.S7_FIXTURE_PYTHON || 'python';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function bounded(promise, ms, label) {
    let timer;
    try {
        return await Promise.race([
            Promise.resolve(promise),
            new Promise((_,reject) => {
                timer = setTimeout(() => reject(new Error('HARNESS_TIMEOUT ' + label)), ms);
            })
        ]);
    } finally {
        clearTimeout(timer);
    }
}

function whenState(endpoint, connected, ms, label) {
    if (endpoint.isConnected === connected) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const name = connected ? 'connect' : 'disconnect';
        const cleanup = () => {
            clearTimeout(timer);
            endpoint.off(name, check);
        };
        const check = () => {
            if (endpoint.isConnected === connected) {
                cleanup();
                resolve();
            }
        };
        const timer = setTimeout(() => {
            cleanup();
            reject(new Error('HARNESS_TIMEOUT ' + label));
        }, ms);
        endpoint.on(name, check);
        check();
    });
}

async function startFixture(logs) {
    const child = spawn(PYTHON, ['-u', path.join(__dirname, 'fixture_server.py')], {
        cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
        env: {...process.env, S7_FIXTURE_PORT: String(PORT), PYTHONUNBUFFERED: '1'}
    });
    let stdout = '', stderr = '', exited = false;
    const gone = new Promise(resolve => child.once('exit', (code, signal) => {
        exited = true;
        resolve({code, signal});
    }));
    const fixture = {
        async stop() {
            if (exited) return;
            child.kill('SIGTERM');
            await Promise.race([gone, sleep(5000)]);
            if (!exited) {
                child.kill('SIGKILL');
                await bounded(gone, 1500, 'fixture exit');
            }
        }
    };
    logs.push(() => ({stdout, stderr}));
    try {
        await bounded(new Promise((resolve, reject) => {
            child.stdout.on('data', chunk => {
                stdout = (stdout + chunk.toString()).slice(-12000);
                if (stdout.includes('S7_WIRE_FIXTURE_READY')) resolve();
            });
            child.stderr.on('data', chunk => {
                stderr = (stderr + chunk.toString()).slice(-12000);
            });
            child.once('error', reject);
            child.once('exit', (code, signal) =>
                reject(new Error('fixture died before ready ' + code + '/' + signal)));
        }), 12000, 'S7 software fixture ready');
        return fixture;
    } catch (error) {
        await fixture.stop();
        throw error;
    }
}

test('command disconnect stops retry; later connect and external loss restore auto-reconnect',
    {timeout: 65000}, async t => {
        fs.mkdirSync(OUT, {recursive: true});
        const evidence = {
            case: 'explicit stop then manual reconnect then external automatic recovery',
            hardware: false, retryMs: RETRY_MS, phases: {},
            connectEvents: 0, disconnectEvents: 0, errors: []
        };
        let endpoint, fixture, blackhole, accepted = 0;
        const peers = new Set(), fixtureLogs = [];
        let firstCotpResolve;
        const firstCotp = new Promise(resolve => { firstCotpResolve = resolve; });
        t.after(async () => {
            if (endpoint) {
                try { await bounded(endpoint.disconnect(), 4000, 'endpoint shutdown'); }
                catch (error) { evidence.cleanupError = String(error); }
            }
            for (const peer of peers) peer.destroy();
            if (blackhole) {
                try { await bounded(new Promise(resolve => blackhole.close(resolve)),
                    3000, 'blackhole shutdown'); }
                catch (error) { evidence.blackholeCleanupError = String(error); }
            }
            if (fixture) {
                try { await fixture.stop(); }
                catch (error) { evidence.fixtureCleanupError = String(error); }
            }
            fs.writeFileSync(path.join(OUT, 's7-manual-reconnect-evidence.json'),
                JSON.stringify(evidence, null, 2) + '\n');
            fs.writeFileSync(path.join(OUT, 's7-manual-reconnect-fixture.log'),
                fixtureLogs.map((read, i) => 'fixture ' + (i + 1) + '\n' +
                    JSON.stringify(read())).join('\n'));
        });

        // Phase A: initial COTP handshake is blackholed, with auto reconnect ON.
        blackhole = net.createServer(peer => {
            accepted++;
            peers.add(peer);
            peer.once('close', () => peers.delete(peer));
            peer.on('error', error => evidence.errors.push('peer: ' + error.code));
            let bytes = Buffer.alloc(0);
            peer.on('data', chunk => {
                bytes = Buffer.concat([bytes, chunk]);
                if (bytes.length >= 22 && accepted === 1) firstCotpResolve(bytes);
            });
        });
        await bounded(new Promise((resolve, reject) => {
            blackhole.once('error', reject);
            blackhole.listen(PORT, '127.0.0.1', resolve);
        }), 4000, 'blackhole listen');
        endpoint = new S7Endpoint({
            host: '127.0.0.1', port: PORT, rack: 0, slot: 1,
            autoReconnect: RETRY_MS, s7ConnOpts: {timeout: 1600}
        });
        endpoint.on('connect', () => evidence.connectEvents++);
        endpoint.on('disconnect', () => evidence.disconnectEvents++);
        endpoint.on('error', error => evidence.errors.push(String(error)));

        const cotp = await bounded(firstCotp, 6000, 'first real COTP request');
        assert.equal(cotp.readUInt16BE(2), 22);
        assert.equal(cotp[5], 0xe0, 'must send RFC1006 COTP connection request');
        assert.equal(endpoint.isConnected, false);
        assert.ok(endpoint._reconnectTimer,
            'precondition: retry must be pending during initial COTP handshake');

        await bounded(endpoint.disconnect(), 2500, 'explicit disconnect during COTP');
        await bounded(new Promise(resolve => {
            if (peers.size === 0) return resolve();
            [...peers][0].once('close', resolve);
        }), 2500, 'COTP peer closed');
        await sleep(RETRY_MS + 350);
        evidence.phases.explicitStop = {
            requestBytes: cotp.length, acceptedAfterRetryWindow: accepted,
            livePeersBeforeFixtureCleanup: peers.size,
            connected: endpoint.isConnected
        };
        assert.equal(accepted, 1, 'no TCP retry after explicit disconnect command');
        assert.equal(peers.size, 0, 'explicit stop closes pending COTP socket');
        assert.equal(endpoint.isConnected, false);

        // Phase B: the SAME instance can reconnect when the caller commands it.
        await bounded(new Promise(resolve => blackhole.close(resolve)),
            4000, 'old COTP peer listener close');
        blackhole = null;
        fixture = await startFixture(fixtureLogs);
        await bounded(endpoint.connect(), 12000, 'explicit new connect');
        assert.equal(endpoint.isConnected, true);
        assert.equal(evidence.connectEvents, 1, 'manual new connect creates one S7 session');
        const group = new S7ItemGroup(endpoint);
        group.setTranslationCB(name => ({temperature: 'DB1,REAL0'})[name]);
        group.addItems(['temperature']);
        const initial = await bounded(group.readAllItems(), 5000, 'read original DB1');
        assert.equal(initial.temperature, 12.5);
        evidence.phases.manualResume = {
            connected: endpoint.isConnected, db1Temperature: initial.temperature,
            connectEvents: evidence.connectEvents
        };

        // Phase C: external loss, NO user disconnect()/connect() during recovery.
        const lost = whenState(endpoint, false, 8000, 'external peer dropped');
        await fixture.stop();
        fixture = null;
        await lost;
        assert.equal(endpoint.isConnected, false, 'external peer loss must change state');
        const previouslyRefused = evidence.errors.filter(s => s.includes('ECONNREFUSED')).length;
        await sleep(RETRY_MS + 1200);
        const refused = evidence.errors.filter(s => s.includes('ECONNREFUSED')).length -
            previouslyRefused;
        assert.ok(refused >= 1, 'auto retry must attempt real TCP while server is absent');
        assert.equal(endpoint.isConnected, false);
        evidence.phases.externalLoss = {
            connected: endpoint.isConnected, refusedAttempts: refused
        };
        fixture = await startFixture(fixtureLogs);
        await whenState(endpoint, true, 14000, 'automatic recovery after external loss');
        assert.equal(endpoint.isConnected, true);
        assert.equal(evidence.connectEvents, 2,
            'recovery must create one second S7 session without user connect()');
        const restored = await bounded(group.readAllItems(), 5000, 'recovered DB1 read');
        assert.equal(restored.temperature, 12.5, 'new session reads synthetic S7Comm DB1');
        evidence.phases.autoRecovered = {
            connected: endpoint.isConnected, db1Temperature: restored.temperature,
            connectEvents: evidence.connectEvents
        };

        // Stop again: even with autoReconnect configured, a command is final.
        await bounded(endpoint.disconnect(), 3000, 'second explicit disconnect');
        const seen = evidence.connectEvents;
        await sleep(RETRY_MS + 350);
        assert.equal(endpoint.isConnected, false);
        assert.equal(evidence.connectEvents, seen,
            'second explicit disconnect must prevent automatic reconnect');
        evidence.phases.finalStop = {
            connected: endpoint.isConnected, connectEvents: evidence.connectEvents
        };
    });
