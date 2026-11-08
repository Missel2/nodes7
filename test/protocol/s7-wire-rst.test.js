'use strict';
// Explicit TCP RST after a real RFC1006/COTP request using actual nodes7.
// HIL-S7-001/-005: PENDING_HARDWARE; loopback fixture only, no physical PLC.
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { S7Endpoint } = require('../../src/index.js');

const OUT = path.resolve(__dirname, '../../test-reports/s7-rst-evidence.json');

async function bounded(promise, ms, label) {
    let timer;
    try {
        return await Promise.race([
            promise,
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error('HARNESS_TIMEOUT: ' + label)), ms);
            })
        ]);
    } finally {
        clearTimeout(timer);
    }
}

test('real nodes7 COTP handshake rejects explicit TCP RST without false connect', { timeout: 23000 }, async t => {
    const evidence = {
        client: 'Missel2/nodes7 candidate source (no published fork release)',
        fault: 'TCP resetAndDestroy after first RFC1006/COTP request',
        binding: '127.0.0.1, ephemeral port',
        hardware: false,
        accepted: 0, resetSent: false, connectEvents: 0, peerErrors: []
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    t.after(() => fs.writeFileSync(OUT, JSON.stringify(evidence, null, 2) + '\n'));
    const peers = new Set();
    const server = net.createServer(peer => {
        evidence.accepted++;
        peers.add(peer);
        peer.on('close', () => peers.delete(peer));
        peer.on('error', error => {
            if (evidence.peerErrors.length < 5) evidence.peerErrors.push(error.code || String(error));
        });
        let prefix = Buffer.alloc(0);
        peer.on('data', chunk => {
            if (evidence.resetSent) return;
            prefix = Buffer.concat([prefix, chunk]).subarray(0, 4);
            if (prefix.length < 4) return;
            evidence.receivedTpkt = prefix[0] === 3 && prefix[1] === 0;
            evidence.resetSupported = typeof peer.resetAndDestroy === 'function';
            if (evidence.resetSupported) {
                evidence.resetSent = true;
                peer.resetAndDestroy();  // Explicit TCP RST, not merely a FIN from destroy().
            } else {
                peer.destroy(); // Test will FAIL; unsupported injection is not a skip/pass.
            }
        });
    });
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    const endpoint = new S7Endpoint({
        host: '127.0.0.1', port: server.address().port,
        rack: 0, slot: 1, autoReconnect: 0, s7ConnOpts: { timeout: 1600 }
    });
    endpoint.on('connect', () => evidence.connectEvents++);
    endpoint.on('error', error => {
        evidence.lastEndpointError = String(error);
    });
    try {
        const start = Date.now();
        try {
            await bounded(endpoint.connect(), 14500, 'COTP setup after TCP RST');
            evidence.connectResolved = true;
        } catch (error) {
            evidence.connectRejected = true;
            evidence.rejection = String(error);
            evidence.harnessTimedOut = /HARNESS_TIMEOUT/.test(String(error));
        }
        evidence.durationMs = Date.now() - start;

        assert.equal(evidence.accepted, 1, 'one TCP connection must reach the peer');
        assert.equal(evidence.receivedTpkt, true, 'real RFC1006 header must reach the peer');
        assert.equal(evidence.resetSupported, true, 'Node runtime must support explicit TCP reset');
        assert.equal(evidence.resetSent, true, 'peer must send a genuine TCP RST');
        assert.equal(evidence.connectRejected, true, 'a reset connection must never succeed');
        assert.equal(evidence.harnessTimedOut, false,
            'a harness timeout is NOT a successful nodes7 rejection');
        assert.equal(evidence.connectEvents, 0, 'no stale connected event');
        assert.equal(endpoint.isConnected, false);
        assert.ok(evidence.durationMs < 14500,
            'nodes7 must reject before the independent harness limit');
    } finally {
        let cleanupError;
        try {
            await bounded(endpoint.disconnect(), 2000, 'RST endpoint disconnect');
            evidence.disconnectResolved = true;
        } catch (error) {
            cleanupError = error;
            evidence.disconnectError = String(error);
        }
        for (const peer of peers) peer.destroy();
        await bounded(new Promise((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
        }), 3000, 'RST fixture shutdown');
        evidence.fixtureClosed = true;
        assert.equal(peers.size, 0, 'all synthetic peer sockets must close');
        assert.equal(cleanupError, undefined, 'endpoint.disconnect must finish after RST');
    }
});
