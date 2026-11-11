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

async function createHarness() {
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
        timeout: 65
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

describe('S7Connection timeout + late response (baseline characterization only)', () => {
    it('currently leaves queued work pending after a standalone request timeout', async () => {
        const h = await createHarness();
        let pending;
        try {
            const first = observed(h.conn.sendRaw(readRequest()));
            pending = observed(h.conn.sendRaw(readRequest()));
            let pendingSettled = false;
            pending.then(() => { pendingSettled = true; });
            const firstResult = await first;
            assert.equal(firstResult.error && firstResult.error.code, 'ERR_TIMEOUT');
            assert.equal(h.conn._jobInProcess.size, 0);
            assert.equal(h.conn._jobQueue.length, 1);
            assert.equal(h.frames.length, 2, 'setup and first request only');
            await new Promise(resolve => setTimeout(resolve, 90));
            assert.equal(pendingSettled, false, 'waiting request currently has no running timeout');
            assert.equal(h.conn._jobQueue.length, 1);
            assert.equal(h.errors.length, 0);
            // This is proof of the *existing defect*, not a desired contract.
        } finally {
            h.conn.destroy();
            h.stream.destroy();
            if (pending) {
                const after = await pending;
                assert.equal(after.error && after.error.code, 'ERR_INTERRUPTED');
            }
        }
    });

    it('currently sends queued work after a late reply to the timed-out PDU', async () => {
        const h = await createHarness();
        let pending;
        try {
            const first = observed(h.conn.sendRaw(readRequest()));
            pending = observed(h.conn.sendRaw(readRequest()));
            const firstResult = await first;
            assert.equal(firstResult.error && firstResult.error.code, 'ERR_TIMEOUT');
            assert.equal(h.conn._jobQueue.length, 1);
            assert.equal(h.conn._jobInProcess.size, 0);
            assert.equal(h.frames.length, 2, 'no second request before the late reply');
            h.stream.push(LATE_READ_REPLY);
            await waitFor(() => h.frames.length === 3);
            assert.equal(h.conn._jobQueue.length, 0);
            assert.equal(h.conn._jobInProcess.size, 1);
            assert.equal(h.errors.length, 0);
            // A dispatched write in this position could have ambiguous effects.
            // Corrected behavior must be specified and independently tested.
        } finally {
            h.conn.destroy();
            h.stream.destroy();
            if (pending) await pending;
        }
    });
});
