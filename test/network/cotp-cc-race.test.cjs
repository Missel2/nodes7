'use strict';
// N7-003: exercise a REAL RFC1006/COTP CC (0xD0) on loopback TCP.
// Cancel when ISO-on-TCP has decoded CC but its connect callback is still
// queued for a later nextTick. No mock stream, no PLC and no fixture-assisted
// close before evidence. The first scenario must prove callback ordering.
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const {S7Endpoint} = require('../../src/index.js');
const {ISOOnTCPParser, constants} = require('iso-on-tcp');

const OUTPUT = path.resolve(__dirname, '../../test-reports');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function deadline(p, ms, label) {
    let timer;
    return Promise.race([
        Promise.resolve(p),
        new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('HARNESS_TIMEOUT ' + label)), ms);
        })
    ]).finally(() => clearTimeout(timer));
}

function observe(promise, ms) {
    let timer;
    return Promise.race([
        Promise.resolve(promise).then(
            () => ({state: 'fulfilled'}),
            error => ({state: 'rejected', code: error?.code || null})
        ),
        new Promise(resolve => {
            timer = setTimeout(() => resolve({state: 'pending'}), ms);
        })
    ]).finally(() => clearTimeout(timer));
}

function emitEvidence(name, data) {
    fs.mkdirSync(OUTPUT, {recursive: true});
    fs.writeFileSync(path.join(OUTPUT, name), JSON.stringify({
        case: name, platform: process.platform, node: process.version,
        hardware: false, realTcp: true, ...data
    }, null, 2) + '\n');
}

function confirmationFromActualRequest(request) {
    assert.ok(request.length >= 22, 'original CR frame must contain 22 bytes');
    assert.equal(request[0], 0x03, 'RFC1006 version');
    assert.equal(request[1], 0x00, 'RFC1006 reserved');
    assert.equal(request.readUInt16BE(2), 22, 'RFC1006 declared frame size');
    assert.equal(request[5], 0xe0, 'COTP request TPDU type');
    // Preserve CR parameters (TPDU size and TSAP) and reply with CC.
    // CC destination must reference the initiator's original source ref.
    const confirm = Buffer.from(request.subarray(0, 22));
    confirm[5] = 0xd0;
    confirm.writeUInt16BE(request.readUInt16BE(8), 6);
    confirm.writeUInt16BE(0x5a17, 8);
    return confirm;
}

async function assertDecodedCC(cc) {
    // Independent ISO-on-TCP parser validation catches fake "CC" packets.
    const parser = new ISOOnTCPParser();
    const result = new Promise((resolve, reject) => {
        parser.once('data', resolve);
        parser.once('error', reject);
    });
    parser.end(cc);
    const packet = await deadline(result, 1000, 'independent CC parser');
    assert.equal(packet.type, constants.tpdu_type.CC);
    assert.equal(packet.source, 0x5a17);
    assert.equal(packet.tpdu_size, 1024);
    return {tpduType: packet.type, frameBytes: cc.length, source: packet.source};
}

async function fixture() {
    const peers = new Set();
    let requestReceived;
    const requestPromise = new Promise(resolve => {requestReceived = resolve});
    let accepted = 0;
    const server = net.createServer(socket => {
        accepted++;
        peers.add(socket);
        socket.on('error', () => {});
        socket.once('close', () => peers.delete(socket));
        let data = Buffer.alloc(0);
        socket.on('data', chunk => {
            data = Buffer.concat([data, chunk]);
            if (data.length >= 22 && requestReceived) {
                const cb = requestReceived;
                requestReceived = undefined;
                cb({socket, request: Buffer.from(data.subarray(0,22))});
            }
        });
    });
    await deadline(new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    }), 2500, 'TCP server listen');
    const port = server.address().port;
    const endpoint = new S7Endpoint({host: '127.0.0.1', port, rack: 0, slot: 1, autoReconnect: 0});
    const seen = {endpointConnect: 0, endpointDisconnect: 0, errors: []};
    endpoint.on('connect', () => seen.endpointConnect++);
    endpoint.on('disconnect', () => seen.endpointDisconnect++);
    endpoint.on('error', e => seen.errors.push(e.code || String(e)));
    const connecting = endpoint.connect();
    connecting.catch(() => {}); // Attach handler before intentional rejection.

    async function awaitCR() {
        const frame = await deadline(requestPromise, 3000, 'real 22-byte COTP CR');
        assert.equal(accepted, 1);
        return frame;
    }

    function handleCount() {
        const handles = typeof process._getActiveHandles === 'function' ?
            process._getActiveHandles() : [];
        return handles.filter(h => h instanceof net.Socket &&
            !h.destroyed && h.remotePort === port).length;
    }

    async function cleanup() {
        try {await deadline(endpoint.disconnect(), 1500, 'fixture endpoint disconnect')}
        finally {
            for (const peer of peers) peer.destroy();
            await deadline(new Promise(resolve => server.close(resolve)), 3000, 'fixture server close');
        }
    }

    return {endpoint, connecting, port, peers, seen, awaitCR, handleCount, cleanup};
}

test('parsed real COTP CC cannot resurrect endpoint when disconnect precedes queued handshake callback',
    {timeout: 8500}, async () => {
    const f = await fixture();
    const report = {scenario: 'parsed CC -> public disconnect -> late ISO-on-TCP connect callback'};
    try {
        const {socket, request} = await f.awaitCR();
        const cc = confirmationFromActualRequest(request);
        report.confirmation = await assertDecodedCC(cc);
        assert.equal(cc.length, 22);
        const client = f.endpoint._pendingTransport;
        assert.ok(client, 'actual pending ISO-on-TCP client is required');
        assert.equal(client.isConnected, false, 'CC must not have arrived yet');

        let rawCount = 0, lateClientConnects = 0, clientClosed = false;
        let publicDisconnect;
        let cancelledDuringRawCC = false;
        let resolveDecoded;
        const decoded = new Promise(resolve => {resolveDecoded = resolve});
        client.on('close', () => {clientClosed = true});
        client.on('connect', () => {
            if (cancelledDuringRawCC) lateClientConnects++;
        });
        client.on('raw-message', message => {
            if (message.type !== constants.tpdu_type.CC) return;
            rawCount++;
            // raw-message is scheduled by ISOOnTCPClient _incomingData before
            // its own 'connect'. This is the deterministic callback race.
            cancelledDuringRawCC = true;
            publicDisconnect = f.endpoint.disconnect();
            publicDisconnect.catch(() => {});
            report.endpointConnectedDuringCancel = f.endpoint.isConnected;
            resolveDecoded();
        });
        const peerClosed = new Promise(resolve => socket.once('close', resolve));
        socket.write(cc);
        report.peerSentCompleteCC = socket.bytesWritten >= 22;
        await deadline(decoded, 3000, 'actual ISO-on-TCP parser did not decode CC');

        report.publicDisconnect = await observe(publicDisconnect, 600);
        report.connect = await observe(f.connecting, 400);
        await deadline(peerClosed, 1000, 'real peer did not close after parsed CC cancellation');
        await sleep(70); // allow queued ISO-on-TCP connect callback to run

        report.decodedCCCount = rawCount;
        report.lateIsoConnectCallbacksAfterCancel = lateClientConnects;
        report.clientStreamClosed = clientClosed;
        report.endpointConnectEvents = f.seen.endpointConnect;
        report.endpointDisconnectEvents = f.seen.endpointDisconnect;
        report.endpointConnectedAfterCallbacks = f.endpoint.isConnected;
        report.s7ConnectionCreated = !!f.endpoint._connection;
        report.peerOpenBeforeFixtureCleanup = f.peers.size;
        report.clientOpenHandlesBeforeFixtureCleanup = f.handleCount();
        report.observedBeforeFixtureCleanup = true;

        assert.equal(report.peerSentCompleteCC, true);
        assert.equal(rawCount, 1, 'actual ISO-on-TCP client must decode exactly one real CC');
        assert.equal(lateClientConnects, 1,
            'ISO-on-TCP connect callback must actually fire AFTER cancellation for this race test');
        assert.equal(report.publicDisconnect.state, 'fulfilled');
        assert.equal(report.connect.state, 'rejected');
        assert.equal(report.connect.code, 'ERR_CONNECTION_CLOSED');
        assert.equal(clientClosed, true);
        assert.equal(report.endpointConnectEvents, 0, 'no stale endpoint connection event');
        assert.equal(report.endpointConnectedAfterCallbacks, false);
        assert.equal(report.s7ConnectionCreated, false, 'late callback must not create S7Conn');
        assert.equal(report.peerOpenBeforeFixtureCleanup, 0);
        assert.equal(report.clientOpenHandlesBeforeFixtureCleanup, 0);
        assert.equal(report.endpointDisconnectEvents, 1, 'exactly one terminal disconnect event');
    } finally {
        emitEvidence('n7-real-cotp-cc-cancelled-after-parse.json', report);
        await f.cleanup();
    }
});

test('real CC queued on TCP immediately before manual cancel cannot revive endpoint',
    {timeout: 6500}, async () => {
    const f = await fixture();
    const report = {scenario: 'peer writes real CC and app cancels before client callback'};
    try {
        const {socket, request} = await f.awaitCR();
        const cc = confirmationFromActualRequest(request);
        report.confirmation = await assertDecodedCC(cc);
        const peerClosed = new Promise(resolve => socket.once('close', resolve));
        socket.write(cc);
        report.peerSentCompleteCC = socket.bytesWritten >= cc.length;
        // No await after peer.write(): cancel before Node processes inbound data.
        const disconnect = f.endpoint.disconnect();
        report.publicDisconnect = await observe(disconnect, 600);
        report.connect = await observe(f.connecting, 400);
        await deadline(peerClosed, 1000, 'real peer TCP must close after cancel');
        await sleep(70);
        report.endpointConnectEvents = f.seen.endpointConnect;
        report.endpointConnected = f.endpoint.isConnected;
        report.peerOpenBeforeFixtureCleanup = f.peers.size;
        report.clientOpenHandlesBeforeFixtureCleanup = f.handleCount();
        report.observedBeforeFixtureCleanup = true;

        assert.equal(report.peerSentCompleteCC, true);
        assert.equal(report.publicDisconnect.state, 'fulfilled');
        assert.equal(report.connect.state, 'rejected');
        assert.equal(report.connect.code, 'ERR_CONNECTION_CLOSED');
        assert.equal(report.endpointConnectEvents, 0);
        assert.equal(report.endpointConnected, false);
        assert.equal(report.peerOpenBeforeFixtureCleanup, 0);
        assert.equal(report.clientOpenHandlesBeforeFixtureCleanup, 0);
    } finally {
        emitEvidence('n7-real-cotp-cc-inflight-cancel.json', report);
        await f.cleanup();
    }
});
