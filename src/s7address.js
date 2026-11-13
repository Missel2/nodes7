//@ts-check
/*
 * Classic S7ANY variable addresses use a 24-bit starting BIT position.
 * Keep byte-unit and bit-unit caller contracts distinct before encoding.
 * Values must be rejected before any request is sent, never truncated using
 * JavaScript's signed 32-bit bitwise shift. No physical PLC activity.
 */
const NodeS7Error = require('./errors.js');
const constants = require('./constants.json');

const MAX_S7ANY_BIT_ADDRESS = 0xffffff;
const MAX_S7ANY_BYTE_ADDRESS = Math.floor(MAX_S7ANY_BIT_ADDRESS / 8);

function unsignedInteger(value, description) {
    // Numeric strings are accepted for backwards compatibility with
    // existing S7Endpoint callers, but empty/boolean values are not.
    const isInput = typeof value === 'number' ||
        (typeof value === 'string' && value.trim().length > 0);
    const number = isInput ? Number(value) : NaN;
    if (!Number.isSafeInteger(number) || number < 0) {
        throw new NodeS7Error('ERR_INVALID_ARGUMENT',
            description + ' must be a nonnegative safe integer');
    }
    return number;
}

function byteSpan(address, length, operation = 'S7ANY byte range') {
    const start = unsignedInteger(address, operation + ' address');
    const count = unsignedInteger(length, operation + ' length');
    if (start > MAX_S7ANY_BYTE_ADDRESS ||
        (count > 0 && count - 1 > MAX_S7ANY_BYTE_ADDRESS - start)) {
        throw new NodeS7Error('ERR_INVALID_ARGUMENT',
            operation + ' exceeds 24-bit S7ANY address field');
    }
    return { address: start, length: count };
}

function wireAddress(item, operation = 'S7ANY item') {
    if (!item || typeof item !== 'object') {
        throw new NodeS7Error('ERR_INVALID_ARGUMENT', operation + ' must be an item');
    }
    if (item.transport === constants.proto.transport.BIT) {
        // For BIT, the public item.address is already a BIT position.
        const start = unsignedInteger(item.address, operation + ' bit address');
        const count = unsignedInteger(item.length, operation + ' bit length');
        if (start > MAX_S7ANY_BIT_ADDRESS ||
            (count > 0 && count - 1 > MAX_S7ANY_BIT_ADDRESS - start)) {
            throw new NodeS7Error('ERR_INVALID_ARGUMENT',
                operation + ' exceeds 24-bit S7ANY bit address field');
        }
        return start;
    }

    if (item.transport === constants.proto.transport.BYTE) {
        // For BYTE, item.length describes byte count; validate its full span.
        return byteSpan(item.address, item.length, operation).address * 8;
    }

    // Other transports (e.g. DATE for counters/timers) use legacy
    // transport-dependent lengths. Validate the start, without inventing a
    // byte-count interpretation for a protocol contract not yet qualified.
    const address = unsignedInteger(item.address, operation + ' address');
    if (address > MAX_S7ANY_BYTE_ADDRESS) {
        throw new NodeS7Error('ERR_INVALID_ARGUMENT',
            operation + ' starting address exceeds 24-bit S7ANY field');
    }
    return address * 8;
}

module.exports = { byteSpan, wireAddress, unsignedInteger,
    MAX_S7ANY_BIT_ADDRESS, MAX_S7ANY_BYTE_ADDRESS };
