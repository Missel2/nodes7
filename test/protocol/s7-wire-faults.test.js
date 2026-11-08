'use strict';
// Real ISO-on-TCP stream abort: no nodes7 mocks, no physical PLC.
// HIL-S7-001/-005 (planned isolated S7-1200 fault tests): PENDING_HARDWARE.
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { S7Endpoint } = require('../../src/index.js');
const OUT = path.resolve(__dirname, '../../test-reports');

function timeout(ms, label) {
    return new Promise((_, reject) => {
        setTimeout(() => reject(new Error(label + ' exceeded ' + ms + 'ms')), ms).unref();
    });
}

test('real nodes7 COTP handshake abort is reported without a false connect', { timeout: 22000 }, async () => {
    let accepted = 0;
    let receivedTpkt = false;
    const server = net.createServer(socket => {
        accepted++;
        socket.once('data', bytes => {
            receivedTpkt = bytes.length >= 4 && bytes[0] === 3 && bytes[1] === 0;
            // Deliberately abort after a client's initial RFC1006 TPKT,
            // before returning a COTP connection confirmation.
            socket.destroy();
        });
    });
    const sockets = new Set();
    server.on('connection', socket => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
    });
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    const port = server.address().port;
    const client = new S7Endpoint({
        host: '127.0.0.1', port, rack: 0, slot: 1, autoReconnect: 0,
        s7ConnOpts: { timeout: 1500 }
    });
    const errors = [];
    client.on('error', error => errors.push(String(error)));
    try {
        // A timeout would mean the client hung, not a successful fault test.
        // nodes7 1.1.2 has a 10s transport-setup watchdog in _connect;
        // do not mistake its built-in bounded error for our own test timeout.
        const startedAt = Date.now();
        let connectionFailure;
        try {
            await Promise.race([client.connect(), timeout(14000, 'partial COTP handshake')]);
        } catch (error) {
            connectionFailure = error;
        }
        assert.ok(connectionFailure, 'a dropped COTP handshake must reject connection');
        assert.doesNotMatch(String(connectionFailure), /exceeded 14000ms/,
            'do not count a hung handshake as a successful rejection');
        assert.ok(Date.now() - startedAt < 14000,
            'the dependency must terminate the connection attempt within its watchdog window');
        assert.equal(client.isConnected, false);
        assert.equal(accepted, 1, 'one controlled TCP connection');
        assert.equal(receivedTpkt, true, 'the client sent a real RFC1006 TPKT');
        fs.mkdirSync(OUT, { recursive: true });
        fs.writeFileSync(path.join(OUT, 's7-fault-evidence.json'),
            JSON.stringify({
                transport: 'real TCP loopback partial COTP abort',
                actualClient: 'Missel2/nodes7 candidate source (no published fork release)',
                acceptedConnections: accepted, receivedTpkt,
                connectRejected: true, hardware: false
            }, null, 2) + '\n');
    } finally {
        // Always clean up the synthetic peer before checking teardown.
        // The known pre-confirmation client socket defect is characterized
        // independently; here we must not silently accept a hung fixture or
        // a failed public disconnect after a server-initiated abort.
        let disconnectError;
        try {
            await Promise.race([client.disconnect(), timeout(1500, 'fault endpoint disconnect')]);
        } catch (error) {
            disconnectError = error;
        }
        for (const socket of sockets) socket.destroy();
        await Promise.race([
            new Promise((resolve, reject) =>
                server.close(error => error ? reject(error) : resolve())
            ),
            timeout(2000, 'fault fixture listener teardown')
        ]);
        assert.equal(sockets.size, 0, 'all synthetic server peer sockets must close');
        assert.equal(disconnectError, undefined,
            'the public endpoint disconnect must settle after server-initiated COTP abort');
    }
});
