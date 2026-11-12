//@ts-check
/*
 * N7-029: multi-PDU writeArea data-integrity regression.
 * Synthetic S7Endpoint public API + in-memory connection responder;
 * NO socket, PLC, plant address or physical write.
 * HIL-S7-003/006 PENDING_HARDWARE.
 * Independent defect discussion: st-one-io/nodes7 PR #18 review.
 */
const assert = require('node:assert/strict');
const S7Endpoint = require('../../src/s7endpoint');
const constants = require('../../src/constants.json');

const PDU = 240;
const MAX_PAYLOAD = PDU - 28;
const START = 100;

function makeEndpoint() {
    const endpoint = new S7Endpoint({ autoReconnect: 0 });
    endpoint._connectionState = 2; // synthetic connected state
    endpoint._pduSize = PDU;
    const writtenMemory = Buffer.alloc(2048, 0xC5);
    const writes = [];
    endpoint._connection = {
        async requestWriteVar(items, data) {
            assert.equal(items.length, 1);
            assert.equal(data.length, 1);
            const { address, area, db, length } = items[0];
            const chunk = Buffer.from(data[0].data);
            writes.push({ address, area, db, length, chunk });
            if (address % 8 === 0 && address / 8 + chunk.length <= writtenMemory.length &&
                address >= 0) {
                chunk.copy(writtenMemory, address / 8);
            }
            return [{ returnCode: constants.proto.retval.DATA_OK }];
        }
    };
    return { endpoint, writes, writtenMemory };
}

function payload(length) {
    return Buffer.from(Array.from({ length }, (_, i) => (i * 79 + 37) & 0xff));
}

function expectedLengths(length) {
    const parts = [];
    for (let offset = 0; offset < length; offset += MAX_PAYLOAD) {
        parts.push(Math.min(length - offset, MAX_PAYLOAD));
    }
    return parts;
}

async function verifyExactWrite(kind, address, length) {
    const h = makeEndpoint();
    const data = payload(length);
    if (kind === 'DB') await h.endpoint.writeDB(7, address, data);
    else if (kind === 'FLAGS') await h.endpoint.writeFlags(address, data);
    else if (kind === 'OUTPUTS') await h.endpoint.writeOutputs(address, data);
    else throw Error('Unknown test entrypoint');

    const lengths = expectedLengths(length);
    assert.deepEqual(h.writes.map(x => x.chunk.length), lengths,
        'every chunk must contain exactly the bytes expected at the PDU boundary');
    assert.deepEqual(h.writes.map(x => x.length), lengths,
        'WRITE_VAR item lengths must match the sent data lengths');

    let offset = 0;
    for (const write of h.writes) {
        assert.equal(write.address, (START + offset) * 8,
            'all PDU destinations must equal base byte address + actual offset');
        assert.deepEqual(write.chunk, data.subarray(offset, offset + write.length),
            'byte contents must match, not merely the number of PDUs');
        offset += write.length;
    }
    assert.equal(offset, length, 'all requested bytes must be submitted');
    assert.deepEqual(h.writtenMemory.subarray(START, START + length), data,
        'synthetic observed memory must exactly equal caller buffer');
    assert.ok(h.writtenMemory.subarray(0, START).every(x => x === 0xC5),
        'bytes before the target address must not be touched');
    assert.ok(h.writtenMemory.subarray(START + length).every(x => x === 0xC5),
        'bytes after the target address must not be touched');

    for (const write of h.writes) {
        assert.equal(write.area,
            kind === 'DB' ? constants.proto.area.DB :
                kind === 'FLAGS' ? constants.proto.area.FLAGS : constants.proto.area.OUTPUTS);
        if (kind === 'DB') assert.equal(write.db, 7);
    }
}

describe('N7-029 S7Endpoint multi-PDU writeArea integrity (synthetic)', () => {
    for (const length of [0, 1, 211, 212, 213, 424, 600]) {
        it('writes exact bytes/offsets at length ' + length + ' (DB, numeric address)', async () => {
            await verifyExactWrite('DB', START, length);
        });
    }

    for (const kind of ['DB', 'FLAGS', 'OUTPUTS']) {
        it('writes all 600 bytes at correct PDU offsets through ' +
            kind + ' with numeric-string address', async () => {
            await verifyExactWrite(kind, String(START), 600);
        });
    }

    it('rejects invalid addresses before any write is submitted', async () => {
        const h = makeEndpoint();
        for (const invalid of [null, undefined, '', '   ', true, false, -1,
            -0.5, 0.5, NaN, Infinity, -Infinity, {}, [], 'abc',
            Number.MAX_SAFE_INTEGER + 1]) {
            await assert.rejects(
                h.endpoint.writeDB(7, invalid, payload(213)),
                error => error && error.code === 'ERR_INVALID_ARGUMENT',
                'invalid base write address: ' + String(invalid)
            );
        }
        assert.equal(h.writes.length, 0,
            'no invalid write may reach even the synthetic transport');
    });

    it('preserves an explicit WRITE_VAR response failure rather than returning success', async () => {
        const h = makeEndpoint();
        h.endpoint._connection.requestWriteVar = async () => [
            { returnCode: constants.proto.retval.DATA_ACCESS_FAULT }
        ];
        await assert.rejects(
            h.endpoint.writeDB(7, START, payload(1)),
            error => error && error.code === constants.proto.retval.DATA_ACCESS_FAULT
        );
    });
});
