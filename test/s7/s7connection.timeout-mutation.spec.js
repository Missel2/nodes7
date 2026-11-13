//@ts-check
/*
  Fail-closed timeout mutation control: disable opt-in timeout abort in an
  isolated copy and prove the same behavioral regression fails.
  Synthetic in-memory S7Comm only; HIL-S7-003/004/005/006 PENDING_HARDWARE.
*/
const assert = require('assert').strict;
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('S7Connection timeout-abort mutation sensitivity', () => {
    it('fails the opt-in queue-abort contract when the abort is deliberately disabled', () => {
        const root = path.resolve(__dirname, '../..');
        const originalPath = path.join(root, 'src', 's7connection.js');
        const source = fs.readFileSync(originalPath, 'utf8');
        const needle = 'if (job && this.abortOnTimeout) this.destroy();';
        assert.equal(source.split(needle).length, 2, 'Abort mutation anchor must be unique');

        const temp = fs.mkdtempSync(path.join(os.tmpdir(), 's7-timeout-mutant-'));
        try {
            const srcDir = path.join(temp, 'src');
            const testDir = path.join(temp, 'test', 's7');
            fs.cpSync(path.join(root, 'src'), srcDir, { recursive: true });
            fs.mkdirSync(testDir, { recursive: true });
            fs.writeFileSync(path.join(srcDir, 's7connection.js'),
                source.replace(needle, 'if (false && job && this.abortOnTimeout) this.destroy();'));
            const isolatedTest = path.join(testDir, 's7connection.timeout-characterization.spec.js');
            fs.copyFileSync(path.join(__dirname, 's7connection.timeout-characterization.spec.js'), isolatedTest);

            const mocha = path.join(root, 'node_modules', 'mocha', 'bin', 'mocha');
            assert.ok(fs.existsSync(mocha), 'Pinned local Mocha installation required');
            const result = spawnSync(process.execPath, [
                mocha, '--no-colors', '--timeout', '3000', '--grep',
                'opt-in abort rejects waiting work', isolatedTest
            ], {
                cwd: root, encoding: 'utf8', timeout: 9000, windowsHide: true,
                env: { ...process.env, NODE_PATH: path.join(root, 'node_modules') }
            });

            assert.equal(result.error, undefined, 'Mutation runner must start and complete');
            assert.equal(result.status, 1, 'Deliberately disabled timeout abort must fail the real regression');
            const output = (result.stdout || '') + (result.stderr || '');
            assert.match(output, /timeout-abort must reject queued work, not strand it/,
                'Failure must be the missing queue abort, not a fixture or setup error');
            assert.match(output, /1 failing/, 'Only the targeted regression must fail');
        } finally {
            fs.rmSync(temp, { recursive: true, force: true, maxRetries: 4, retryDelay: 50 });
        }
    });
});
