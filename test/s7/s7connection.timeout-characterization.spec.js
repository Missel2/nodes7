//@ts-check
/*
  Baseline characterization of a standalone S7Connection timeout with queued
  work; these assertions document current behavior, NOT desired safe semantics.
  No production code changes. Synthetic in-memory S7Comm only.
  HIL-S7-003/004/005/006: PENDING_HARDWARE.
*/
const assert = require('assert').strict;
const { Duplex } = require('stream');
const { once } = require('events');
const S7Connection = require('../../src/s7connection');
const constants = require('../../src/constants.json');

const SETUP_REPLY = Buffer.from('320300000000000800000000f0000003000300f0', 'hex');
const LATE_READ_REPLY = Buffer.from('3203000000010002000500000401ff04000808', 'hex');

function readRequest() {
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

async function createHarness(options = {}) {
    const frames = [];
    const errors = [];
    const stream = new Duplex({
        read() {},
        write(chunk, encoding, done) {
            frames.push(Buffer.from(chunk));
            if (frames.length === 1) process.nextTick(() => this.push(SETUP_REPLY));
            done();
        }
    });
    const conn = new S7Connection(stream, {
        maxJobs: 1,
        maxQueuedJobs: 1,
        timeout: 65,
        ...options
    });
    conn.on('error', e => errors.push(e));
    const ready = once(conn, 'connect');
    conn.connect();
    await ready;
    return { conn, stream, frames, errors };
}

async function waitFor(predicate, maxMs = 650) {
    const stop = Date.now() + maxMs;
    while (!predicate() && Date.now() < stop) {
        await new Promise(resolve => setTimeout(resolve, 8));
    }
    assert.ok(predicate(), 'Synthetic wire observation deadline');
}

describe('S7Connection timeout + late response (safe opt-in regression)', () => {
    // Baseline-red on source with no abortOnTimeout support; green only after
    // rejected waiting requests cannot later dispatch on a timed-out session.
    it('opt-in abort rejects waiting work and closes the connection on timeout', async () => {
        const h = await createHarness({ abortOnTimeout: true });
        let waiting;
        try {
            const first = observed(h.conn.sendRaw(readRequest()));
            waiting = observed(h.conn.sendRaw(readRequest()));
            const firstResult = await first;
            assert.equal(firstResult.error && firstResult.error.code, 'ERR_TIMEOUT');
            const queuedResult = await Promise.race([
                waiting,
                new Promise(resolve => setTimeout(() => resolve({ error: { code: 'ERR_ABORT_MISSING' } }), 160))
            ]);
            assert.equal(queuedResult.error && queuedResult.error.code, 'ERR_INTERRUPTED',
                'timeout-abort must reject queued work, not strand it');
            assert.equal(h.conn.isConnected, false);
            assert.equal(h.conn._jobQueue.length, 0);
            assert.equal(h.conn._jobInProcess.size, 0);
            assert.equal(h.frames.length, 2, 'only setup and first PDU were sent');
            assert.equal(h.errors.length, 0);
        } finally {
            h.conn.destroy();
            h.stream.destroy();
            if (waiting) await waiting;
        }
    });

    it('opt-in abort prevents a late reply from dispatching queued work', async () => {
        const h = await createHarness({ abortOnTimeout: true });
        let waiting;
        try {
            const first = observed(h.conn.sendRaw(readRequest()));
            waiting = observed(h.conn.sendRaw(readRequest()));
            const firstResult = await first;
            assert.equal(firstResult.error && firstResult.error.code, 'ERR_TIMEOUT');
            const queuedResult = await Promise.race([
                waiting,
                new Promise(resolve => setTimeout(() => resolve({ error: { code: 'ERR_ABORT_MISSING' } }), 160))
            ]);
            assert.equal(queuedResult.error && queuedResult.error.code, 'ERR_INTERRUPTED');
            h.stream.push(LATE_READ_REPLY);
            await new Promise(resolve => setTimeout(resolve, 35));
            assert.equal(h.frames.length, 2, 'late ACK must never send previously queued work');
            assert.equal(h.conn._jobQueue.length, 0);
            assert.equal(h.conn._jobInProcess.size, 0);
            assert.equal(h.conn.isConnected, false);
            assert.equal(h.errors.length, 0);
        } finally {
            h.conn.destroy();
            h.stream.destroy();
            if (waiting) await waiting;
        }
    });

    it('rejects ambiguous abortOnTimeout types instead of silently disabling safety', () => {
        for (const value of [null, 1, 0, 'true', {}, []]) {
            const stream = new Duplex({ read() {}, write(_data, _enc, done) { done(); } });
            try {
                assert.throws(() => new S7Connection(stream, { abortOnTimeout: value }),
                    e => e.code === 'ERR_INVALID_ARGUMENT');
            } finally {
                stream.destroy();
            }
        }
    });

    // Compatibility counterexample: no opt-in preserves prior direct-client
    // semantics; it is characterization, NOT a recommendation to use them.
    it('keeps existing direct-client timeout semantics without opt-in', async () => {
        const h = await createHarness();
        let waiting;
        try {
            const first = observed(h.conn.sendRaw(readRequest()));
            waiting = observed(h.conn.sendRaw(readRequest()));
            const firstResult = await first;
            assert.equal(firstResult.error && firstResult.error.code, 'ERR_TIMEOUT');
            assert.equal(h.conn._jobQueue.length, 1);
            assert.equal(h.conn._jobInProcess.size, 0);
            h.stream.push(LATE_READ_REPLY);
            await waitFor(() => h.frames.length === 3);
            assert.equal(h.conn._jobQueue.length, 0);
            assert.equal(h.conn._jobInProcess.size, 1);
        } finally {
            h.conn.destroy();
            h.stream.destroy();
            if (waiting) await waiting;
        }
    });
});
