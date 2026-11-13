//@ts-check
/*
 * N7-029: preflight the complete WRITE_VAR byte span against the 24-bit S7ANY
 * bit address field before any request can be submitted.
 * Pure synthetic test; no network, PLC or physical write.
 * HIL-S7-003/006 PENDING_HARDWARE.
 */
const assert = require('node:assert/strict');
const S7Endpoint = require('../../src/s7endpoint');
const constants = require('../../src/constants.json');

const MAX_WIRE_BYTE_ADDRESS = Math.floor(0xffffff / 8);

function makeEndpoint() {
    const endpoint = new S7Endpoint({ autoReconnect: 0 });
    endpoint._connectionState = 2; // synthetic connected state
    endpoint._pduSize = 240;
    const submitted = [];
    endpoint._connection = {
        async requestWriteVar(items, data) {
            submitted.push({ items, data });
            return [{ returnCode: constants.proto.retval.DATA_OK }];
        }
    };
    return { endpoint, submitted };
}

describe('N7-029 S7ANY 24-bit write-address span preflight', () => {
    it('refuses an integer byte address that wraps to zero on left-shift', async () => {
        const h = makeEndpoint();
        const wrappedByteAddress = 2 ** 29;
        assert.equal(wrappedByteAddress << 3, 0,
            'negative control: legacy shift would alias the start of the area');
        await assert.rejects(
            h.endpoint.writeDB(7, wrappedByteAddress, Buffer.from([0xa5])),
            error => error && error.code === 'ERR_INVALID_ARGUMENT',
            'the caller must never receive false success for a wrapped address'
        );
        assert.equal(h.submitted.length, 0, 'not one PDU may be submitted');
    });

    it('rejects out-of-wire-range base and crossing spans before any dispatch', async () => {
        const h = makeEndpoint();
        for (const [kind, address, length] of [
            ['DB', MAX_WIRE_BYTE_ADDRESS + 1, 1],
            ['FLAGS', String(MAX_WIRE_BYTE_ADDRESS), 2],
            ['OUTPUTS', MAX_WIRE_BYTE_ADDRESS - 99, 101],
            ['DB', 2 ** 29, 600]
        ]) {
            const payload = Buffer.alloc(length, 0x69);
            const operation = kind === 'DB' ? h.endpoint.writeDB(7, address, payload) :
                kind === 'FLAGS' ? h.endpoint.writeFlags(address, payload) :
                    h.endpoint.writeOutputs(address, payload);
            await assert.rejects(operation,
                error => error && error.code === 'ERR_INVALID_ARGUMENT',
                kind + ' must reject the complete overflowed span before sending');
        }
        assert.equal(h.submitted.length, 0, 'no partial PDU may escape preflight');
    });

    it('preserves the last legal single-byte S7ANY address', async () => {
        const h = makeEndpoint();
        await h.endpoint.writeDB(7, String(MAX_WIRE_BYTE_ADDRESS), Buffer.from([0xa5]));
        assert.equal(h.submitted.length, 1);
        assert.equal(h.submitted[0].items[0].address, 0xfffff8);
        assert.deepEqual(h.submitted[0].data[0].data, Buffer.from([0xa5]));
    });
});
