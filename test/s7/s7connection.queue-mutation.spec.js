//@ts-check
/*
  Synthetic mutation negative-control for the new optional S7 waiting queue.
  The real checked-out production source remains unchanged. HIL: not applicable
  (isolated local source mutation, no network/controller access).
*/
const assert = require('assert').strict;
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('S7Connection queue regression mutation sensitivity', () => {
    it('fails the exact admission test if the capacity check is deliberately bypassed', () => {
        const root = path.resolve(__dirname, '../..');
        const originalPath = path.join(root, 'src', 's7connection.js');
        const source = fs.readFileSync(originalPath, 'utf8');
        const needle = 'if (this.maxQueuedJobs !== null && !dispatchImmediately &&';
        assert.equal(source.split(needle).length, 2, 'Mutation anchor must be unique');
        const temp = fs.mkdtempSync(path.join(os.tmpdir(), 's7-queue-mutant-'));
        try {
            const srcDir = path.join(temp, 'src');
            const testDir = path.join(temp, 'test', 's7');
            fs.cpSync(path.join(root, 'src'), srcDir, { recursive: true });
            fs.mkdirSync(testDir, { recursive: true });
            const mutated = source.replace(needle, 'if (false && this.maxQueuedJobs !== null && !dispatchImmediately &&');
            fs.writeFileSync(path.join(srcDir, 's7connection.js'), mutated);
            const isolatedTest = path.join(testDir, 's7connection.queue.spec.js');
            fs.copyFileSync(path.join(__dirname, 's7connection.queue.spec.js'), isolatedTest);
            const mocha = path.join(root, 'node_modules', 'mocha', 'bin', 'mocha');
            assert.ok(fs.existsSync(mocha), 'The pinned local Mocha executable is required');
            const result = spawnSync(process.execPath, [
                mocha, '--no-colors', '--timeout', '3000', '--grep',
                'rejects the next request before send', isolatedTest
            ], {
                cwd: root, encoding: 'utf8', timeout: 9000, windowsHide: true,
                env: { ...process.env, NODE_PATH: path.join(root, 'node_modules') }
            });
            assert.equal(result.error, undefined, 'Mutation subprocess must not time out or fail to spawn');
            assert.equal(result.status, 1, 'The deliberate queue admission bypass must cause exactly one test failure');
            const output = (result.stdout || '') + (result.stderr || '');
            assert.match(output, /ERR_NOT_REFUSED/, 'Failure must be the intended missing queue refusal');
            assert.match(output, /1 failing/, 'Only the isolated admission regression must fail');
        } finally {
            fs.rmSync(temp, { recursive: true, force: true, maxRetries: 4, retryDelay: 50 });
        }
    });
});
