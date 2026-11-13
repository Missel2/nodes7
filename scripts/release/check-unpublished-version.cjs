'use strict';

// Read-only public npm registry guard. A version already visible on npm must
// never be reused as a new candidate. Staged, non-public versions are outside
// this check's visibility and still require separate human authorization.
const assert = require('node:assert/strict');
const https = require('node:https');
const pkg = require('../../package.json');
const EXPECTED_VERSION = '0.1.0-alpha.2';
const EXPECTED_NAME = '@missel2/nodes7';
assert.equal(pkg.name, EXPECTED_NAME);
assert.equal(pkg.version, EXPECTED_VERSION);
assert.deepEqual(pkg.publishConfig, {access: 'public', tag: 'alpha'});

const url = 'https://registry.npmjs.org/' +
    encodeURIComponent(EXPECTED_NAME) + '/' + encodeURIComponent(EXPECTED_VERSION);
const req = https.get(url, {
    headers: {'Accept': 'application/vnd.npm.install-v1+json', 'User-Agent': 'nodes7-alpha2-readonly-preflight'}
}, res => {
    // Do not log any registry response data or package metadata.
    res.resume();
    res.on('end', () => {
        if (res.statusCode === 404) {
            console.log('NODES7_ALPHA2_PUBLIC_REGISTRY_ABSENT (GET-only; staged state not checked)');
            return;
        }
        console.error('NODES7_ALPHA2_RELEASE_BLOCKED: public registry HTTP ' + res.statusCode);
        process.exitCode = 1;
    });
});
req.setTimeout(15000, () => req.destroy(new Error('npm registry GET timeout')));
req.on('error', error => {
    console.error('NODES7_ALPHA2_REGISTRY_CHECK_FAILED: ' + error.code);
    process.exitCode = 1;
});
