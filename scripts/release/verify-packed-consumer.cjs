'use strict';

// Install the actual unpublished npm pack archive, not source imports.
// Disposable local temp directory, localhost-free and PLC-free.
// Works on GitHub-hosted Ubuntu/Windows Node 22 with no publish credentials.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createRequire} = require('node:module');
const {spawnSync} = require('node:child_process');
const {verifyPackage} = require('../ci/check-package.cjs');

const root = path.resolve(__dirname, '../..');
const name = '@missel2/nodes7';
const version = '0.1.0-alpha.2';

function npm(args, cwd) {
    const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm',
        args, {
            cwd, encoding: 'utf8', timeout: 120000, windowsHide: true,
            shell: process.platform === 'win32',
            env: {...process.env, npm_config_ignore_scripts: 'true',
                npm_config_audit: 'false', npm_config_fund: 'false'}
        });
    assert.equal(result.error, undefined, 'npm subprocess must start and finish');
    assert.equal(result.status, 0, 'npm ' + args[0] + ' failed: ' +
        (result.stderr || '').slice(-900));
    return result.stdout;
}

async function main() {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'nodes7-alpha2-consumer-'));
    try {
        const archiveDirectory = path.join(temporary, 'archive');
        const consumerDirectory = path.join(temporary, 'consumer');
        fs.mkdirSync(archiveDirectory);
        fs.mkdirSync(consumerDirectory);
        const packed = JSON.parse(npm([
            'pack', '--ignore-scripts', '--json',
            '--pack-destination', archiveDirectory
        ], root));
        verifyPackage(packed);
        const info = packed[0];
        assert.equal(info.name, name);
        assert.equal(info.version, version);
        assert.ok(info.files.some(entry => entry.path === 'src/s7address.js'));
        const tarball = path.join(archiveDirectory, info.filename);
        assert.equal(path.dirname(tarball), archiveDirectory);
        const bytes = fs.readFileSync(tarball);
        const integrity = 'sha512-' +
            crypto.createHash('sha512').update(bytes).digest('base64');
        assert.equal(info.integrity, integrity);
        const digest = crypto.createHash('sha256').update(bytes).digest('hex');

        // Diagnose whether cross-OS archive differences are in file
        // *contents* versus tar metadata/modes. Source is public synthetic
        // code only, and the per-file checksums reveal no PLC values.
        const audit = info.files.map(entry => {
            const file = path.join(root, entry.path);
            const source = fs.readFileSync(file);
            return {
                path: entry.path,
                size: source.length,
                packMode: entry.mode,
                sourceSha256: crypto.createHash('sha256').update(source).digest('hex')
            };
        }).sort((a, b) => a.path.localeCompare(b.path, 'en'));
        console.log('NODES7_ALPHA2_PACK_FILE_AUDIT=' + JSON.stringify(audit));

        fs.writeFileSync(path.join(consumerDirectory, 'package.json'),
            JSON.stringify({name: 'nodes7-release-isolated-consumer', version: '1.0.0',
                private: true}, null, 2) + '\n', {mode: 0o600});
        npm(['install', '--ignore-scripts', '--no-audit', '--no-fund',
            '--package-lock=false', '--no-save', tarball], consumerDirectory);

        // Require from the installed consumer node_modules, never from root/src.
        const consumerRequire = createRequire(path.join(consumerDirectory, 'check.cjs'));
        const entry = consumerRequire.resolve(name);
        assert.ok(entry.startsWith(path.join(consumerDirectory, 'node_modules')),
            'Resolved entry must come from unpacked consumer dependency');
        const installed = consumerRequire(name);
        const installedPkg = consumerRequire(name + '/package.json');
        assert.equal(installedPkg.name, name);
        assert.equal(installedPkg.version, version);
        assert.equal(installedPkg.license, 'GPL-3.0-or-later');
        const {createRequire: makeRequire} = require('node:module');
        const dependencyRequire = makeRequire(entry);
        const transportMain = dependencyRequire.resolve('iso-on-tcp');
        assert.ok(transportMain.startsWith(path.join(consumerDirectory, 'node_modules')),
            'Runtime transport must resolve from isolated installed package');
        assert.equal(typeof dependencyRequire('iso-on-tcp'), 'object',
            'Installed runtime transport must be loadable');
        for (const symbol of ['S7Endpoint', 'S7Connection', 'S7Parser',
            'S7Serializer', 'S7Item', 'S7ItemGroup']) {
            assert.equal(typeof installed[symbol], 'function', 'Missing export ' + symbol);
        }
        const endpoint = new installed.S7Endpoint({autoReconnect: 0});
        endpoint._connectionState = 2;
        endpoint._pduSize = 240;
        let submitted = 0;
        endpoint._connection = {
            async requestReadVars(items) {
                submitted++;
                return items.map(item => ({
                    returnCode: installed.s7constants.proto.retval.DATA_OK,
                    data: Buffer.alloc(item.length, 0x21)
                }));
            }
        };
        await assert.rejects(endpoint.readDB(2, 2 ** 29, 1),
            err => err && err.code === 'ERR_INVALID_ARGUMENT');
        await assert.rejects(endpoint.readDB(2, 0x1fffff, 2),
            err => err && err.code === 'ERR_INVALID_ARGUMENT');
        assert.equal(submitted, 0, 'Rejected reads must not escape from installed package');
        const accepted = await endpoint.readDB(2, 0, 1);
        assert.deepEqual(accepted, Buffer.from([0x21]));
        assert.equal(submitted, 1);

        console.log('NODES7_ALPHA2_PACKED_CONSUMER_PASS');
        console.log('NODES7_ALPHA2_PACKED_SHA256=' + digest);
        console.log('NODES7_ALPHA2_INSTALLED_VERSION=' + version);
        console.log('NODES7_ALPHA2_PUBLISH_STATUS=not-published-by-ci');
    } finally {
        fs.rmSync(temporary, {recursive: true, force: true,
            maxRetries: 4, retryDelay: 50});
    }
}
main().catch(error => {
    console.error('NODES7_ALPHA2_PACKED_CONSUMER_FAILED: ' + error.message);
    process.exitCode = 1;
});
