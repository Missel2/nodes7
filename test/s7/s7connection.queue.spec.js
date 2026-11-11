//@ts-check
/*
  Regression fixtures for the optional S7Connection waiting-queue limit.
  All traffic is synthetic; no physical Siemens controller is contacted.
  HIL-S7-003/004/005/006 remain PENDING_HARDWARE.
*/
const assert = require('assert').strict;
const { Duplex } = require('stream');
const { once } = require('events');
const net = require('net');
const S7Connection = require('../../src/s7connection');
const constants = require('../../src/constants.json');

const SETUP_REPLY = Buffer.from('320300000000000800000000f0000003000300f0', 'hex');

function request() {
    return {
        header: { type: constants.proto.type.REQUEST },
        param: {
            function: constants.proto.function.READ_VAR,
            items: [{
                syntax: constants.proto.syntax.S7ANY,
                area: constants.proto.area.INPUTS,
                transport: constants.proto.transport.BYTE,
                address: 0,
                length: 1
            }]
        }
    };
}

function observed(promise) {
    return promise.then(value => ({ value }), error => ({ error }));
}

async function syntheticConnection(opts, holdSetup = false) {
    const frames = [];
    const stream = new Duplex({
        read() {},
        write(chunk, encoding, done) {
            frames.push(Buffer.from(chunk));
            if (frames.length === 1 && !holdSetup) {
                process.nextTick(() => this.push(SETUP_REPLY));
            }
            done();
        }
    });
    const conn = new S7Connection(stream, { maxJobs: 1, timeout: 0, ...opts });
    const ready = once(conn, 'connect');
    conn.connect();
    if (!holdSetup) await ready;
    return { conn, stream, frames, ready };
}

describe('S7Connection optional queued-job capacity', () => {
    it('rejects the next request before send when one PDU is in flight and two are waiting', async () => {
        const h = await syntheticConnection({ maxQueuedJobs: 2 });
        const promises = [];
        try {
            for (let i = 0; i < 3; i++) promises.push(observed(h.conn.sendRaw(request())));
            const refusedPayload = request();
            const fourth = observed(h.conn.sendRaw(refusedPayload));
            const result = await Promise.race([
                fourth,
                new Promise(resolve => setTimeout(() => resolve({ error: { code: 'ERR_NOT_REFUSED' } }), 80))
            ]);
            assert.equal(result.error && result.error.code, 'ERR_QUEUE_FULL');
            assert.equal(result.error.info && result.error.info.sent, false);
            assert.equal(h.conn._jobInProcess.size, 1);
            assert.equal(h.conn._jobQueue.length, 2);
            assert.equal(Object.prototype.hasOwnProperty.call(refusedPayload.header, 'pduReference'), false);
            await new Promise(resolve => setImmediate(resolve));
            assert.equal(h.frames.length, 2, 'only setup and first request may reach the peer');
        } finally {
            h.conn.destroy();
            h.stream.destroy();
            await Promise.all(promises);
        }
    });

    it('permits immediate wire dispatch when maxQueuedJobs=0, rejects waiting jobs', async () => {
        const h = await syntheticConnection({ maxQueuedJobs: 0 });
        const promises = [];
        try {
            promises.push(observed(h.conn.sendRaw(request())));
            const refused = await Promise.race([
                observed(h.conn.sendRaw(request())),
                new Promise(resolve => setTimeout(() => resolve({ error: { code: 'ERR_NOT_REFUSED' } }), 80))
            ]);
            assert.equal(refused.error && refused.error.code, 'ERR_QUEUE_FULL');
            assert.equal(h.conn._jobQueue.length, 0);
            assert.equal(h.conn._jobInProcess.size, 1);
            await new Promise(resolve => setImmediate(resolve));
            assert.equal(h.frames.length, 2);
        } finally {
            h.conn.destroy();
            h.stream.destroy();
            await Promise.all(promises);
        }
    });

    it('bounds requests waiting during setup without sending an unadmitted request', async () => {
        const h = await syntheticConnection({ maxQueuedJobs: 1 }, true);
        const promises = [];
        try {
            promises.push(observed(h.conn.sendRaw(request())));
            const refused = await Promise.race([
                observed(h.conn.sendRaw(request())),
                new Promise(resolve => setTimeout(() => resolve({ error: { code: 'ERR_NOT_REFUSED' } }), 80))
            ]);
            assert.equal(refused.error && refused.error.code, 'ERR_QUEUE_FULL');
            assert.equal(h.conn._jobQueue.length, 1);
            assert.equal(h.frames.length, 1, 'no application request while connecting');
            h.stream.push(SETUP_REPLY);
            await h.ready;
            assert.equal(h.conn._jobQueue.length, 0);
            assert.equal(h.conn._jobInProcess.size, 1);
        } finally {
            h.conn.destroy();
            h.stream.destroy();
            await Promise.all(promises);
        }
    });

    it('keeps the existing unbounded behavior when the new option is omitted', async () => {
        const h = await syntheticConnection({});
        const promises = [];
        try {
            for (let i = 0; i < 6; i++) promises.push(observed(h.conn.sendRaw(request())));
            assert.equal(h.conn._jobInProcess.size, 1);
            assert.equal(h.conn._jobQueue.length, 5, 'no silent default capacity change');
        } finally {
            h.conn.destroy();
            h.stream.destroy();
            await Promise.all(promises);
        }
    });

    it('rejects invalid queue limits instead of silently disabling the bound', () => {
        for (const value of [-1, 1.5, '2', NaN, Infinity, null, 9007199254740992]) {
            const stream = new Duplex({ read() {}, write(_chunk, _enc, cb) { cb(); } });
            try {
                assert.throws(() => new S7Connection(stream, { maxQueuedJobs: value }), e => e.code === 'ERR_INVALID_ARGUMENT');
            } finally {
                stream.destroy();
            }
        }
    });

    it('enforces the same queue cap through a real disposable localhost TCP S7Comm peer', async () => {
        const frames = [];
        const sockets = [];
        const server = net.createServer(socket => {
            sockets.push(socket);
            socket.on('data', buf => {
                frames.push(Buffer.from(buf));
                if (frames.length === 1) socket.write(SETUP_REPLY);
            });
        });
        let conn;
        let client;
        const pending = [];
        try {
            await new Promise((resolve, reject) => {
                server.once('error', reject);
                server.listen(0, '127.0.0.1', resolve);
            });
            client = net.connect({ host: '127.0.0.1', port: server.address().port });
            await once(client, 'connect');
            conn = new S7Connection(client, { maxJobs: 1, maxQueuedJobs: 1, timeout: 0 });
            const ready = once(conn, 'connect');
            conn.connect();
            await ready;
            pending.push(observed(conn.sendRaw(request())));
            pending.push(observed(conn.sendRaw(request())));
            const rejected = await Promise.race([
                observed(conn.sendRaw(request())),
                new Promise(resolve => setTimeout(() => resolve({ error: { code: 'ERR_NOT_REFUSED' } }), 80))
            ]);
            assert.equal(rejected.error && rejected.error.code, 'ERR_QUEUE_FULL');
            assert.equal(conn._jobQueue.length, 1);
            assert.equal(conn._jobInProcess.size, 1);
            await new Promise(resolve => setTimeout(resolve, 25));
            assert.equal(frames.length, 2, 'network observed setup and one application telegram only');
        } finally {
            if (conn) conn.destroy();
            if (client) client.destroy();
            for (const s of sockets) s.destroy();
            await Promise.all(pending);
            if (server.listening) await new Promise(resolve => server.close(resolve));
        }
    });
});
