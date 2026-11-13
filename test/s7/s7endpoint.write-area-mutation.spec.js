//@ts-check
/*
 * N7-029 independent regression sensitivity: restoring the legacy truncated
 * slice must fail the exact-data public writeDB test on a source-isolated copy.
 * No physical PLC or network traffic. HIL-S7-003/006 PENDING_HARDWARE.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

describe('N7-029 multi-PDU write integrity mutation sensitivity', () => {
    it('detects the old slice-end bug using the same exact-byte regression', () => {
        const root = path.resolve(__dirname, '../..');
        const sourcePath = path.join(root, 'src', 's7endpoint.js');
        const source = fs.readFileSync(sourcePath, 'utf8');
        const fixed = 'data.slice(ptr, Math.min(ptr + maxPayload, dataLength))';
        const broken = 'data.slice(ptr, Math.min(dataLength - ptr, maxPayload))';
        assert.equal(source.split(fixed).length, 2, 'the corrected slice anchor must exist exactly once');

        const temp = fs.mkdtempSync(path.join(os.tmpdir(), 's7-write-integrity-mutant-'));
        try {
            const tempSrc = path.join(temp, 'src');
            const tempTest = path.join(temp, 'test', 's7');
            fs.cpSync(path.join(root, 'src'), tempSrc, { recursive: true });
            fs.mkdirSync(tempTest, { recursive: true });
            fs.writeFileSync(path.join(tempSrc, 's7endpoint.js'), source.replace(fixed, broken));

            const isolatedTest = path.join(tempTest, 's7endpoint.write-area-integrity.spec.js');
            fs.copyFileSync(path.join(__dirname, 's7endpoint.write-area-integrity.spec.js'), isolatedTest);

            const mocha = path.join(root, 'node_modules', 'mocha', 'bin', 'mocha');
            assert.ok(fs.existsSync(mocha), 'Pinned Mocha must be installed');
            const result = spawnSync(process.execPath, [
                mocha, '--no-colors', '--timeout', '3000', '--grep',
                'writes exact bytes/offsets at length 600', isolatedTest
            ], {
                cwd: root, encoding: 'utf8', windowsHide: true, timeout: 9000,
                env: { ...process.env, NODE_PATH: path.join(root, 'node_modules') }
            });

            assert.equal(result.error, undefined, 'Mutation subprocess must finish without a runner timeout');
            assert.equal(result.status, 1, 'The legacy partial-write bug must fail the unmodified test');
            const output = (result.stdout || '') + (result.stderr || '');
            assert.match(output, /every chunk must contain exactly the bytes expected at the PDU boundary/,
                'Test must fail for wrong write bytes/lengths, not because of setup or imports');
            assert.match(output, /1 failing/, 'Exactly one targeted regression must fail in the mutant');
        } finally {
            fs.rmSync(temp, { recursive: true, force: true, maxRetries: 4, retryDelay: 50 });
        }
    });
});
