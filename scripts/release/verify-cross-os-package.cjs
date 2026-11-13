'use strict';

// Compare only signed-by-CI metadata; neither job uploads a tarball.
// Exit nonzero if hosted Windows and Ubuntu pack different bytes.
// The exact final source SHA is supplied by the workflow.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(process.argv[2] || 'release-evidence/cross-os');
const names = ['nodes7-alpha2-packed-ubuntu-24.04', 'nodes7-alpha2-packed-windows-2025'];

function read(name) {
    const file = path.join(root, name, 'packed-consumer.json');
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
}
const [ubuntu, windows] = names.map(read);
for (const record of [ubuntu, windows]) {
    assert.equal(record.schemaVersion, 1, 'Invalid evidence schema');
    assert.equal(record.package.name, '@missel2/nodes7');
    assert.equal(record.package.version, '0.1.0-alpha.2');
    assert.match(record.sourceCommit, /^[0-9a-f]{40}$/);
    if (process.env.SOURCE_SHA) {
        assert.equal(record.sourceCommit, process.env.SOURCE_SHA,
            'Package files came from another source commit');
    }
    assert.ok(record.package.fileCount >= 8);
    assert.equal(record.package.fileCount, record.files.length);
    assert.match(record.package.archiveSha256, /^[0-9a-f]{64}$/);
    assert.match(record.package.archiveIntegrity, /^sha512-/);
    assert.ok(record.files.some(f => f.path === 'src/s7address.js'),
        'Must contain all S7ANY address validators');
}
assert.equal(ubuntu.runnerPlatform, 'linux');
assert.equal(windows.runnerPlatform, 'win32');
assert.equal(ubuntu.sourceCommit, windows.sourceCommit, 'Different source SHAs');
// Compare real source bytes in tarball input including file permissions.
// Different Windows CRLF checkout bytes or source modes MUST fail.
assert.deepEqual(windows.files, ubuntu.files,
    'Windows and Ubuntu packed inputs differ (line endings, file bytes or modes)');
assert.equal(windows.package.archiveSha256, ubuntu.package.archiveSha256,
    'Windows and Ubuntu npm tarballs are not byte-identical');
assert.equal(windows.package.archiveIntegrity, ubuntu.package.archiveIntegrity,
    'Windows and Ubuntu npm tarball SHA512 differs');
console.log('NODES7_ALPHA2_CROSS_OS_ARCHIVE_BYTES_IDENTICAL');
console.log('NODES7_ALPHA2_CANONICAL_ARCHIVE_SHA256=' + ubuntu.package.archiveSha256);
console.log('NODES7_ALPHA2_COMPARE_SOURCE=' + ubuntu.sourceCommit);
console.log('NODES7_ALPHA2_PUBLISH_STATUS=not-published-by-ci');
