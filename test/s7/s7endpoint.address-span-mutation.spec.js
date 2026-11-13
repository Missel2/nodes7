//@ts-check
/*
 * N7-032: independent mutant restores a permissive S7ANY range and MUST
 * fail the same exact readArea overflow test in an isolated source copy.
 * Synthetic-only. Physical HIL-S7-002/003/006 remain PENDING_HARDWARE.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

describe('N7-032 S7ANY range regression mutation control', () => {
    it('fails the exact public readDB regression if the 24-bit limit is removed', () => {
        const root = path.resolve(__dirname, '../..');
        const source = fs.readFileSync(path.join(root, 'src/s7address.js'), 'utf8');
        const anchor = 'const MAX_S7ANY_BIT_ADDRESS = 0xffffff;';
        assert.equal(source.split(anchor).length, 2, 'exact production range guard must exist');

        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'n7-032-wire-range-mutant-'));
        try {
            fs.cpSync(path.join(root, 'src'), path.join(tmp, 'src'), { recursive: true });
            const dest = path.join(tmp, 'test', 's7');
            fs.mkdirSync(dest, { recursive: true });
            fs.copyFileSync(path.join(__dirname, 's7endpoint.read-generic-address-span.spec.js'),
                path.join(dest, 's7endpoint.read-generic-address-span.spec.js'));
            fs.writeFileSync(path.join(tmp, 'src/s7address.js'),
                source.replace(anchor, 'const MAX_S7ANY_BIT_ADDRESS = 0x1ffffffff;'));
            const mocha = path.join(root, 'node_modules', 'mocha', 'bin', 'mocha');
            assert.ok(fs.existsSync(mocha), 'Pinned Mocha must be installed');
            const result = spawnSync(process.execPath, [
                mocha, '--no-colors', '--timeout', '3000',
                '--grep', 'rejects a large address that would alias zero',
                path.join(dest, 's7endpoint.read-generic-address-span.spec.js')
            ], {
                cwd: root, encoding: 'utf8', timeout: 9000, windowsHide: true,
                env: { ...process.env, NODE_PATH: path.join(root, 'node_modules') }
            });
            assert.equal(result.error, undefined, 'Mutant must not time out');
            assert.equal(result.status, 1, 'Mutant must fail the exact test');
            const output = (result.stdout || '') + (result.stderr || '');
            assert.match(output, /Missing expected rejection/,
                'only the intended rejection assertion may fail');
            assert.match(output, /1 failing/,
                'one named readDB overflow test must fail, not setup');
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true,
                maxRetries: 4, retryDelay: 50 });
        }
    });
});
