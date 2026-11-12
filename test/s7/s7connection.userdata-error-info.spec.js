//@ts-check
/*
 * Synthetic upstream st-one-io/nodes7 PR #18 regression.
 * The PLC userdata returnCode must survive the existing NodeS7Error while
 * the protocol-level error is still thrown, never silently treated as success.
 * No sockets, PLCs or physical writes. HIL-S7-002/005 PENDING_HARDWARE.
 */
const assert = require('node:assert/strict');
const { Duplex } = require('node:stream');
const S7Connection = require('../../src/s7connection');
const constants = require('../../src/constants.json');

function syntheticUserDataConnection(answer) {
    const stream = new Duplex({
        read() {},
        write(chunk, encoding, callback) { callback(); }
    });
    const connection = new S7Connection(stream, { timeout: 0 });
    const requests = [];
    connection.sendRaw = async request => {
        requests.push(request);
        return answer;
    };
    return { connection, stream, requests };
}

describe('S7Connection upstream #18 UserData error metadata (synthetic)', () => {
    it('preserves numeric protocol error and exposes exact PLC userdata returnCode', async () => {
        const code = 0x8104;
        const returnCode = constants.proto.retval.DATA_ERR;
        const h = syntheticUserDataConnection({
            param: { errorCode: code, sequenceNumber: 0, hasMoreData: false },
            data: { returnCode, payload: Buffer.alloc(0) }
        });
        try {
            await assert.rejects(h.connection.listBlocks('DB'), error => {
                assert.equal(error.code, code, 'original protocol error code must survive');
                assert.equal(error.info && error.info.returnCode, returnCode,
                    'do not discard the response returnCode');
                return true;
            });
            assert.equal(h.requests.length, 1, 'no automatic retry');
        } finally {
            h.connection.destroy();
            h.stream.destroy();
        }
    });

    it('preserves the error even if the response has no data object', async () => {
        const h = syntheticUserDataConnection({
            param: { errorCode: 0x8104 },
            data: null
        });
        try {
            await assert.rejects(h.connection.listBlocks('DB'), error => {
                assert.equal(error.code, 0x8104);
                assert.equal(error.info && error.info.returnCode, undefined);
                return true;
            });
            assert.equal(h.requests.length, 1);
        } finally {
            h.connection.destroy();
            h.stream.destroy();
        }
    });

    it('does not alter successful UserData payload handling', async () => {
        const payload = Buffer.from('001122', 'hex');
        const h = syntheticUserDataConnection({
            param: { errorCode: constants.proto.error.OK,
                sequenceNumber: 0, hasMoreData: false },
            data: { returnCode: constants.proto.retval.DATA_OK, payload }
        });
        try {
            const result = await h.connection.sendUserData(
                constants.proto.userData.function.BLOCK_FUNC,
                constants.proto.userData.subfunction.BLOCK_FUNC.TYPE);
            assert.deepEqual(result, payload);
            assert.equal(h.requests.length, 1);
        } finally {
            h.connection.destroy();
            h.stream.destroy();
        }
    });
});
