//@ts-check
/*
 * N7-029/N7-011: a write ACK proves only that PDU's response was received.
 * A later write may have been applied even if its ACK is lost. This tests
 * S7Endpoint -> actual S7Connection -> encoded S7Comm over a disposable
 * localhost TCP socket (customTransport bypasses COTP). It is NOT a Siemens
 * CPU or full ISO-on-TCP qualification. HIL-S7-003/006 PENDING_HARDWARE.
 */
const assert = require('node:assert/strict');
const net = require('node:net');
const S7Endpoint = require('../../src/s7endpoint');

const SETUP_REPLY = Buffer.from('320300000000000800000000f0000003000300f0', 'hex');
const PAYLOAD = Buffer.from(Array.from({ length: 600 }, (_, i) => (i * 79 + 37) & 0xff));

function writeAck(pdu) {
    const ack = Buffer.from('3203000000000002000100000501ff', 'hex');
    ack.writeUInt16BE(pdu, 4);
    return ack;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor(predicate, deadlineMs = 1400) {
    const end = Date.now() + deadlineMs;
    while (!predicate() && Date.now() < end) await delay(10);
    assert.ok(predicate(), 'Local S7Comm peer observation deadline');
}

async function faultCase({ secondApplied, autoReconnect }) {
    const memory = Buffer.alloc(1024, 0xc5);
    const submissions = [];
    const peerErrors = [];
    const sockets = new Set();
    let accepted = 0;
    let acked = 0;
    let connected = 0;
    let sawFirstPeerClose = false;
    const server = net.createServer(socket => {
        accepted++;
        const session = accepted;
        sockets.add(socket);
        socket.on('error', error => peerErrors.push(error.code || String(error)));
        socket.on('close', () => {
            sockets.delete(socket);
            if (session === 1) sawFirstPeerClose = true;
        });
        let buffered = Buffer.alloc(0);
        socket.on('data', incoming => {
            buffered = Buffer.concat([buffered, incoming]);
            // Direct S7Comm-over-TCP frames; COTP itself is covered by the
            // independent real python-snap7 wire-roundtrip suite.
            while (buffered.length >= 10 && !socket.destroyed) {
                if (buffered[0] !== 0x32 || buffered[1] !== 0x01) {
                    peerErrors.push('INVALID_S7_REQUEST_HEADER');
                    socket.destroy();
                    return;
                }
                const length = 10 + buffered.readUInt16BE(6) + buffered.readUInt16BE(8);
                if (length < 12 || length > 4096) {
                    peerErrors.push('INVALID_S7_REQUEST_LENGTH');
                    socket.destroy();
                    return;
                }
                if (buffered.length < length) break;
                const packet = buffered.subarray(0, length);
                buffered = buffered.subarray(length);
                const fn = packet[10];
                if (fn === 0xf0) {
                    socket.write(SETUP_REPLY);
                    continue;
                }
                if (fn !== 0x05 || packet[11] !== 1) {
                    peerErrors.push('UNEXPECTED_S7_JOB');
                    socket.destroy();
                    return;
                }
                const addressBits = packet.readUIntBE(21, 3);
                const db = packet.readUInt16BE(18);
                const declaredBits = packet.readUInt16BE(10 + 14 + 2);
                const bytes = packet.subarray(10 + 14 + 4);
                const address = addressBits / 8;
                const attempt = {
                    session, pdu: packet.readUInt16BE(4), db, address,
                    size: bytes.length, exact: Buffer.from(bytes)
                };
                submissions.push(attempt);
                if (db !== 2 || !Number.isInteger(address) ||
                    declaredBits !== bytes.length * 8 || address + bytes.length > memory.length) {
                    peerErrors.push('INVALID_WRITE_FRAME');
                    socket.destroy();
                    return;
                }
                if (session !== 1 || submissions.length > 2) {
                    peerErrors.push('WRITE_REPLAY_OR_UNEXPECTED_THIRD_PDU');
                    socket.destroy();
                    return;
                }
                if (submissions.length === 1) {
                    bytes.copy(memory, address);
                    socket.write(writeAck(attempt.pdu));
                    acked++;
                } else {
                    // Distinguish an unacknowledged write that really happened
                    // from a second write that never reached the peer's DB.
                    if (secondApplied) bytes.copy(memory, address);
                    socket.destroy(); // ACK for PDU 2 is intentionally lost
                }
            }
        });
    });
    let endpoint;
    let clientErrors = [];
    try {
        await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', resolve);
        });
        const port = server.address().port;
        endpoint = new S7Endpoint({
            autoReconnect,
            customTransport: () => new Promise((resolve, reject) => {
                const stream = net.connect({ host: '127.0.0.1', port });
                const onError = e => reject(e);
                stream.once('error', onError);
                stream.once('connect', () => {
                    stream.off('error', onError);
                    resolve(stream);
                });
            }),
            s7ConnOpts: {
                maxJobs: 1, maxQueuedJobs: 2, maxPDUSize: 240,
                timeout: 500, abortOnTimeout: true
            }
        });
        endpoint.on('error', e => clientErrors.push(String(e)));
        endpoint.on('connect', () => connected++);
        await Promise.race([
            endpoint.connect(),
            delay(1600).then(() => { throw Error('connect did not settle'); })
        ]);

        let rejection;
        try {
            await Promise.race([
                endpoint.writeDB(2, '100', PAYLOAD),
                delay(1600).then(() => { throw Error('partial write did not settle'); })
            ]);
        } catch (e) {
            rejection = e;
        }
        assert.ok(rejection, 'unacknowledged second PDU must never report complete write success');
        assert.equal(rejection && rejection.code, 'ERR_INTERRUPTED',
            'interrupted multi-PDU write must report loss, never successful completion');
        assert.doesNotMatch(String(rejection), /did not settle/, 'a hanging write is not a passing fault');
        await waitFor(() => sawFirstPeerClose);
        assert.equal(acked, 1, 'only first PDU has an acknowledged WRITE_VAR response');
        assert.equal(submissions.length, 2,
            'third PDU must remain unsent after transport loss with maxJobs=1');
        assert.deepEqual(submissions.map(x => x.address), [100, 312]);
        assert.deepEqual(submissions.map(x => x.size), [212, 212]);
        assert.deepEqual(submissions[0].exact, PAYLOAD.subarray(0, 212));
        assert.deepEqual(submissions[1].exact, PAYLOAD.subarray(212, 424));

        const expectedBytes = secondApplied ? 424 : 212;
        assert.deepEqual(memory.subarray(100, 100 + expectedBytes),
            PAYLOAD.subarray(0, expectedBytes),
            'fixture independently records bytes actually applied');
        assert.ok(memory.subarray(100 + expectedBytes).every(v => v === 0xc5),
            'unacknowledged and unsent ranges must not be fabricated as applied');
        assert.equal(memory[99], 0xc5, 'before-range sentinel is preserved');
        assert.equal(memory[700], 0xc5, 'after-range sentinel is preserved');

        if (autoReconnect) {
            await waitFor(() => connected >= 2);
            assert.equal(accepted, 2, 'only one configured reconnect to the synthetic peer');
            assert.equal(endpoint.isConnected, true);
        } else {
            assert.equal(endpoint.isConnected, false);
        }
        await delay(85);
        assert.equal(submissions.length, 2, 'reconnect must not replay either ambiguous PDU');
        assert.deepEqual(peerErrors, [], 'no protocol error or extra write was observed');
        return {
            submittedBytes: submissions.reduce((n, v) => n + v.size, 0),
            acknowledgedPDUs: acked,
            fixtureAppliedBytes: expectedBytes,
            reconnects: accepted - 1,
            rejected: true,
            clientErrorEvents: clientErrors.length
        };
    } finally {
        if (endpoint) await endpoint.disconnect();
        for (const socket of sockets) socket.destroy();
        if (server.listening) await new Promise(resolve => server.close(resolve));
    }
}

describe('N7-029 explicitly rejected PDU with other chunks already applied (synthetic)', () => {
    it('rejects the whole write without erasing successful nonadjacent chunks', async () => {
        const constants = require('../../src/constants.json');
        const endpoint = new S7Endpoint({ autoReconnect: 0 });
        endpoint._connectionState = 2;
        endpoint._pduSize = 240;
        const actualMemory = Buffer.alloc(1024, 0xc5);
        const submissions = [];
        endpoint._connection = {
            async requestWriteVar(items, data) {
                assert.equal(items.length, 1);
                assert.equal(data.length, 1);
                const index = submissions.length;
                const address = items[0].address / 8;
                const bytes = Buffer.from(data[0].data);
                submissions.push({ index, address, bytes });
                // PDU 2 is explicitly NACKed; first and third can still write.
                if (index === 1) return [{ returnCode: constants.proto.retval.DATA_ACCESS_FAULT }];
                bytes.copy(actualMemory, address);
                return [{ returnCode: constants.proto.retval.DATA_OK }];
            }
        };

        try {
            await assert.rejects(
                endpoint.writeDB(2, '100', PAYLOAD),
                error => error && error.code === constants.proto.retval.DATA_ACCESS_FAULT,
                'an explicit WRITE_VAR NACK must reject the complete logical write'
            );
            assert.deepEqual(submissions.map(s => [s.address, s.bytes.length]),
                [[100, 212], [312, 212], [524, 176]]);
            assert.deepEqual(actualMemory.subarray(100, 312), PAYLOAD.subarray(0, 212));
            assert.ok(actualMemory.subarray(312, 524).every(v => v === 0xc5),
                'a NACKed chunk was not applied in this controlled scenario');
            assert.deepEqual(actualMemory.subarray(524, 700), PAYLOAD.subarray(424),
                'a later concurrent chunk may still be applied despite the earlier NACK');
            assert.equal(submissions.length, 3, 'no automatic retry after NACK');
        } finally {
            endpoint._connectionState = 0;
            endpoint._connection = null;
        }
    });
});

describe('N7-029 ambiguous multi-PDU write over disposable TCP', () => {
    it('rejects after PDU 1 ACK and PDU 2 disconnect before apply; never sends PDU 3', async () => {
        const e = await faultCase({ secondApplied: false, autoReconnect: 0 });
        assert.deepEqual({
            submittedBytes: e.submittedBytes,
            acknowledgedPDUs: e.acknowledgedPDUs,
            fixtureAppliedBytes: e.fixtureAppliedBytes,
            reconnects: e.reconnects,
            rejected: e.rejected
        }, { submittedBytes: 424, acknowledgedPDUs: 1, fixtureAppliedBytes: 212,
            reconnects: 0, rejected: true });
    });

    it('does not replay an applied-but-unacknowledged PDU after automatic reconnect', async () => {
        const e = await faultCase({ secondApplied: true, autoReconnect: 70 });
        assert.deepEqual({
            submittedBytes: e.submittedBytes,
            acknowledgedPDUs: e.acknowledgedPDUs,
            fixtureAppliedBytes: e.fixtureAppliedBytes,
            reconnects: e.reconnects,
            rejected: e.rejected
        }, { submittedBytes: 424, acknowledgedPDUs: 1, fixtureAppliedBytes: 424,
            reconnects: 1, rejected: true });
    });
});
