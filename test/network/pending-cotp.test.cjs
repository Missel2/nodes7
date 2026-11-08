'use strict';
// P0 N7-003: independent, executable regression on this repository's real
// S7Endpoint source. The disposable peer is loopback-only and does not pretend
// to be a Siemens CPU. Before a fix the two assertions MUST fail.
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');

const candidate = process.env.N7_ENDPOINT_SOURCE || '../../src/s7endpoint.js';
const S7Endpoint = require(candidate);
const EVIDENCE_DIR = path.resolve(__dirname, '../../test-reports');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function observe(promise, durationMs) {
    return new Promise(resolve => {
        let done = false;
        const timer = setTimeout(() => {
            if (!done) { done = true; resolve({state: 'pending'}); }
        }, durationMs);
        Promise.resolve(promise).then(
            result => { if (!done) { done = true; clearTimeout(timer); resolve({state: 'fulfilled', result}); } },
            error => { if (!done) { done = true; clearTimeout(timer); resolve({state: 'rejected', code: error?.code || null, error: error?.message || String(error)}); } }
        );
    });
}

function deadline(promise, ms, label) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('HARNESS_TIMEOUT ' + label)), ms);
        Promise.resolve(promise).then(
            result => { clearTimeout(timer); resolve(result); },
            error => { clearTimeout(timer); reject(error); }
        );
    });
}

async function setupBlackhole(label) {
    const peerSockets = new Set();
    let accepted = 0, firstRequest;
    let resolveRequest;
    const requestSeen = new Promise(resolve => { resolveRequest = resolve; });
    let peerClosed;
    const closeObserved = new Promise(resolve => { peerClosed = resolve; });
    const server = net.createServer(socket => {
        accepted++;
        peerSockets.add(socket);
        socket.once('close', () => { peerSockets.delete(socket); peerClosed(); });
        let chunks = [], bytes = 0;
        socket.on('data', part => {
            chunks.push(part);
            bytes += part.length;
            if (bytes >= 22 && !firstRequest) {
                firstRequest = Buffer.concat(chunks);
                resolveRequest();
            }
            // Deliberately withhold all COTP and S7Comm responses.
        });
        socket.on('error', () => {}); // Deliberate fixture teardown may reset a socket.
    });
    await deadline(new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    }), 3000, 'listener did not bind');

    const port = server.address().port;
    const endpoint = new S7Endpoint({
        host: '127.0.0.1', port, rack: 0, slot: 1, autoReconnect: 0
    });
    let lateConnectEvents = 0;
    const endpointErrors = [];
    endpoint.on('connect', () => { lateConnectEvents++; });
    endpoint.on('error', error => { endpointErrors.push({code: error?.code, message: error?.message}); });

    const connecting = endpoint.connect();
    // Rejections from an eventually cancelled/failed pending connection are
    // observed rather than ignored. The test does not claim successful connect.
    connecting.catch(() => {});

    async function observedRequest() {
        await deadline(requestSeen, 3000, '22-byte COTP connection request was not received');
        assert.equal(accepted, 1, 'exactly one loopback TCP peer expected');
        assert.equal(firstRequest[0], 3, 'RFC1006 TPKT version must be 3');
        assert.equal(firstRequest[1], 0, 'RFC1006 TPKT reserved byte must be 0');
        assert.equal(firstRequest.readUInt16BE(2), 22, 'actual COTP connection request should be 22 bytes');
        assert.equal(firstRequest[5], 0xe0, 'real COTP connect request code should be 0xE0');
        return {requestBytes: firstRequest.length, accepted, port};
    }

    function clientOpenHandles() {
        // Supplemental diagnostic only: _getActiveHandles is a Node private API.
        const handles = typeof process._getActiveHandles === 'function'
            ? process._getActiveHandles() : [];
        return handles.filter(h => h instanceof net.Socket && !h.destroyed && h.remotePort === port).length;
    }
    function observation() {
        return {
            peerOpenBeforeFixtureCleanup: [...peerSockets].filter(s => !s.destroyed).length,
            clientOpenHandlesBeforeFixtureCleanup: clientOpenHandles(),
            connectedEvents: lateConnectEvents,
            endpointConnected: endpoint.isConnected,
            endpointErrors
        };
    }
    async function cleanup() {
        // Cleanup happens strictly AFTER all measured assertions and JSON evidence.
        for (const socket of peerSockets) socket.destroy();
        await deadline(new Promise(resolve => server.close(resolve)), 3000, 'fixture close');
    }
    function persist(data) {
        fs.mkdirSync(EVIDENCE_DIR, {recursive: true});
        fs.writeFileSync(path.join(EVIDENCE_DIR, label + '.json'),
            JSON.stringify({
                scenario: label,
                source: candidate,
                gitBaseline: 'f201bcc0acdad4742e4066fa084577f23e396ce1',
                host: process.platform,
                node: process.version,
                hardware: false,
                ...data
            }, null, 2) + '\n');
    }
    return {endpoint, connecting, observedRequest, closeObserved, observation, cleanup, persist};
}

test('early disconnect must settle and close unfinished COTP transport', {timeout: 12000}, async () => {
    const fixture = await setupBlackhole('cotp-early-disconnect');
    const report = {assertion: 'early disconnect must settle and close unfinished COTP transport'};
    try {
        Object.assign(report, await fixture.observedRequest());
        const disconnect = fixture.endpoint.disconnect();
        report.publicDisconnect = await observe(disconnect, 600);
        report.peerClosed = await observe(fixture.closeObserved, 600);
        report.connectionAttempt = await observe(fixture.connecting, 200);
        Object.assign(report, fixture.observation());
        report.observedBeforeFixtureCleanup = true;
        assert.equal(report.publicDisconnect.state, 'fulfilled',
            'N7_COTP_EARLY_DISCONNECT: public disconnect must settle promptly');
        assert.equal(report.peerClosed.state, 'fulfilled',
            'N7_COTP_EARLY_PEER: peer must observe close without fixture assistance');
        assert.equal(report.peerOpenBeforeFixtureCleanup, 0,
            'N7_COTP_EARLY_SOCKET: no socket may remain live before fixture cleanup');
        assert.equal(report.connectedEvents, 0, 'N7_COTP_EARLY_STALE_CONNECT');
        assert.equal(report.connectionAttempt.state, 'rejected',
            'N7_COTP_EARLY_CONNECT_PROMISE: cancelled connect must reject promptly');
    } finally {
        fixture.persist(report);
        await fixture.cleanup();
    }
});

test('watchdog timeout must release blackholed COTP TCP transport', {timeout: 18000}, async () => {
    const fixture = await setupBlackhole('cotp-watchdog-timeout');
    const report = {assertion: 'watchdog timeout must release blackholed COTP TCP transport'};
    try {
        Object.assign(report, await fixture.observedRequest());
        report.connect = await observe(fixture.connecting, 11600);
        assert.equal(report.connect.state, 'rejected',
            'N7_COTP_TIMEOUT: endpoint watchdog must reject a stalled connect');
        report.peerClosed = await observe(fixture.closeObserved, 600);
        report.disconnect = await observe(fixture.endpoint.disconnect(), 400);
        Object.assign(report, fixture.observation());
        report.observedBeforeFixtureCleanup = true;
        assert.equal(report.peerClosed.state, 'fulfilled',
            'N7_COTP_WATCHDOG_PEER: watchdog must close actual TCP peer');
        assert.equal(report.peerOpenBeforeFixtureCleanup, 0,
            'N7_COTP_WATCHDOG_SOCKET: no socket may remain live before fixture cleanup');
        assert.equal(report.disconnect.state, 'fulfilled',
            'N7_COTP_WATCHDOG_DISCONNECT: public disconnect must settle after watchdog');
        assert.equal(report.connectedEvents, 0, 'N7_COTP_WATCHDOG_STALE_CONNECT');
    } finally {
        fixture.persist(report);
        await fixture.cleanup();
    }
});
