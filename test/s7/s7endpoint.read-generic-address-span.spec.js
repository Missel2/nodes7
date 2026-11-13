//@ts-check
/*
 * N7-032: 24-bit S7ANY address bounds across public read/generic and
 * grouped item paths. All fixtures are synthetic, no network or real PLC.
 * HIL-S7-002/003/006 remain PENDING_HARDWARE.
 */
const assert = require('node:assert/strict');
const S7Endpoint = require('../../src/s7endpoint');
const S7ItemGroup = require('../../src/s7itemGroup');
const c = require('../../src/constants.json');

const MAX_BITS = 0xffffff;
const MAX_BYTES = Math.floor(MAX_BITS / 8);
const DATA_OK = c.proto.retval.DATA_OK;

function endpointWithWireObserver() {
    const endpoint = new S7Endpoint({ autoReconnect: 0 });
    endpoint._connectionState = 2; // only synthetic connected state
    endpoint._pduSize = 240;
    const calls = [];
    endpoint._connection = {
        async requestReadVars(items) {
            calls.push({ kind: 'read', items: items.map(i => ({ ...i })) });
            return items.map(i => ({ returnCode: DATA_OK, data: Buffer.alloc(i.length || 0, 0x35) }));
        },
        async requestWriteVar(items, data) {
            calls.push({ kind: 'write', items: items.map(i => ({ ...i })), data });
            return items.map(() => ({ returnCode: DATA_OK }));
        }
    };
    return { endpoint, calls };
}

function invalid(error) {
    return error && error.code === 'ERR_INVALID_ARGUMENT';
}

describe('N7-032 S7ANY readArea complete range admission', () => {
    it('rejects a large address that would alias zero before any wire request', async () => {
        const h = endpointWithWireObserver();
        assert.equal((2 ** 29) << 3, 0, 'legacy 32-bit shift aliases zero');
        await assert.rejects(h.endpoint.readDB(2, 2 ** 29, 1), invalid);
        assert.deepEqual(h.calls, [], 'invalid read must not be silently redirected');
    });

    it('rejects overflowed base and crossing span for every byte-area read API', async () => {
        const h = endpointWithWireObserver();
        for (const [kind, address, size] of [
            ['db', MAX_BYTES + 1, 1],
            ['flags', String(MAX_BYTES), 2],
            ['outputs', MAX_BYTES - 100, 102],
            ['inputs', 2 ** 29, 600],
            ['db', MAX_BYTES, 223]
        ]) {
            const read = kind === 'db' ? h.endpoint.readDB(2, address, size) :
                kind === 'flags' ? h.endpoint.readFlags(address, size) :
                    kind === 'inputs' ? h.endpoint.readInputs(address, size) :
                        h.endpoint.readOutputs(address, size);
            await assert.rejects(read, invalid, kind + ' full-span admission');
        }
        assert.equal(h.calls.length, 0, 'no early valid chunk may be sent');
    });

    it('rejects invalid ranges without submitting data', async () => {
        const h = endpointWithWireObserver();
        for (const [address, length] of [[0,-1],[0,1.5],[0,Infinity],
            [0,NaN],[0,'bad'],[MAX_BYTES + 1,0]]) {
            await assert.rejects(h.endpoint.readDB(2, address, length), invalid);
        }
        assert.equal(h.calls.length, 0);
    });

    it('preserves the last legal byte and numeric string compatibility', async () => {
        const h = endpointWithWireObserver();
        const value = await h.endpoint.readDB(2, String(MAX_BYTES), 1);
        assert.deepEqual(value, Buffer.from([0x35]));
        assert.deepEqual(h.calls.map(x => x.items[0].address), [0xfffff8]);
    });
});

describe('N7-032 S7ANY generic readVars and writeVars preflight', () => {
    for (const operation of ['read', 'write']) {
        const invoke = (h, items) => operation === 'read' ?
            h.endpoint.readVars(items) : h.endpoint.writeVars(items.map(item => ({
                ...item,
                dataTransport: c.proto.dataTransport.BBYTE,
                data: Buffer.from([0x45])
            })));

        const byteItem = (address, length = 1) => ({
            area: c.proto.area.DB, db: 2,
            transport: c.proto.transport.BYTE, address, length
        });
        const bitItem = (address, length = 1) => ({
            area: c.proto.area.FLAGS,
            transport: c.proto.transport.BIT, address, length
        });

        it(operation + ' rejects wrapped and crossing byte/bit items before dispatch', async () => {
            const h = endpointWithWireObserver();
            for (const item of [
                byteItem(2 ** 29), byteItem(MAX_BYTES + 1),
                byteItem(MAX_BYTES, 2), bitItem(MAX_BITS + 1),
                bitItem(MAX_BITS, 2), bitItem(2 ** 29),
                byteItem(-1), bitItem(0.5), byteItem('', 1)
            ]) {
                await assert.rejects(invoke(h, [item]), invalid);
            }
            assert.equal(h.calls.length, 0);
        });

        it(operation + ' rejects any invalid item in a mixed batch atomically before send', async () => {
            const h = endpointWithWireObserver();
            await assert.rejects(invoke(h, [
                byteItem(100), byteItem(2 ** 29)
            ]), invalid);
            assert.equal(h.calls.length, 0);
        });

        it(operation + ' preserves encoded last legal byte and bit address', async () => {
            const h = endpointWithWireObserver();
            await invoke(h, [byteItem(String(MAX_BYTES)), bitItem(MAX_BITS)]);
            assert.equal(h.calls.length, 1);
            assert.deepEqual(h.calls[0].items.map(i => i.address),
                [0xfffff8, 0xffffff], 'BYTE is scaled to bits; BIT remains a raw bit address');
        });
    }
});

describe('N7-032 S7ItemGroup preflight before multi-PDU dispatch', () => {
    it('readAllItems refuses a bad later item without sending earlier valid read', async () => {
        const h = endpointWithWireObserver();
        const group = new S7ItemGroup(h.endpoint);
        try {
            group.addItems(['DB2,BYTE1', 'DB2,BYTE536870912']);
            await assert.rejects(group.readAllItems(), invalid);
            assert.equal(h.calls.length, 0, 'all group items must be validated first');
        } finally {
            group.destroy();
        }
    });

    it('writeItems refuses a bad later item without writing earlier valid data', async () => {
        const h = endpointWithWireObserver();
        const group = new S7ItemGroup(h.endpoint);
        try {
            await assert.rejects(group.writeItems([
                'DB2,BYTE1', 'DB2,BYTE536870912'
            ], [42, 43]), invalid);
            assert.equal(h.calls.length, 0, 'no earlier write may escape batch preflight');
        } finally {
            group.destroy();
        }
    });

    it('BIT item near wire boundary cannot silently wrap during group write', async () => {
        const h = endpointWithWireObserver();
        const group = new S7ItemGroup(h.endpoint);
        try {
            await assert.rejects(
                group.writeItems('DB2,X2097151.7.2', [true, false]), invalid
            );
            assert.equal(h.calls.length, 0);
        } finally {
            group.destroy();
        }
    });
});
