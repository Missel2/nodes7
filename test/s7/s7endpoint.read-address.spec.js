//@ts-check
/*
 * Synthetic regression for S7Endpoint readArea address conversion.
 * Derived problem report: st-one-io/nodes7 PR #18, Julia Schwartz.
 * HIL-S7-002/004: PENDING_HARDWARE. No PLC/socket is used.
 */
const assert = require('node:assert/strict');
const S7Endpoint = require('../../src/s7endpoint');
const constants = require('../../src/constants.json');

function endpointWithSyntheticRead() {
    const endpoint = new S7Endpoint({ autoReconnect: 0 });
    endpoint._connectionState = 2; // S7Endpoint's connected state; no transport created
    endpoint._pduSize = 240;
    const requests = [];
    endpoint._connection = {
        async requestReadVars(items) {
            const index = requests.length;
            requests.push(items.map(item => ({ ...item })));
            return items.map(item => ({
                returnCode: constants.proto.retval.DATA_OK,
                data: Buffer.alloc(item.length, 0x31 + index)
            }));
        }
    };
    return { endpoint, requests };
}

describe('S7Endpoint readArea upstream #18 address validation (synthetic)', () => {
    for (const address of [100, '100', ' 100 ']) {
        it('preserves the complete multi-PDU read and byte offsets for ' +
            JSON.stringify(address), async () => {
            const { endpoint, requests } = endpointWithSyntheticRead();
            const data = await endpoint.readDB(1, address, 600);
            assert.equal(data.length, 600);
            assert.equal(requests.length, 3);
            assert.deepEqual(requests.map(items => items[0].address),
                [100 * 8, 322 * 8, 544 * 8],
                'numeric byte addresses must be converted before adding chunk offsets');
            assert.deepEqual(requests.map(items => items[0].length), [222, 222, 156]);
            assert.ok(data.subarray(0, 222).every(byte => byte === 0x31));
            assert.ok(data.subarray(222, 444).every(byte => byte === 0x32));
            assert.ok(data.subarray(444).every(byte => byte === 0x33));
        });
    }

    it('rejects invalid address values before submitting any read PDU', async () => {
        const { endpoint, requests } = endpointWithSyntheticRead();
        for (const invalid of [null, undefined, '', '  ', -1, -0.5, 0.5,
            NaN, Infinity, -Infinity, true, false, {}, [], 'abc',
            Number.MAX_SAFE_INTEGER + 1]) {
            await assert.rejects(
                endpoint.readDB(1, invalid, 600),
                error => error && error.code === 'ERR_INVALID_ARGUMENT',
                'invalid address should be rejected: ' + String(invalid)
            );
        }
        assert.equal(requests.length, 0,
            'invalid addresses must not reach the transport');
    });

    it('retains zero-based read address support', async () => {
        const { endpoint, requests } = endpointWithSyntheticRead();
        const result = await endpoint.readFlags('0', 1);
        assert.equal(result.length, 1);
        assert.equal(requests.length, 1);
        assert.equal(requests[0][0].address, 0);
    });
});
