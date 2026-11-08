# Test strategy and confidence levels

| Layer | Environment | Evidence | What it does not prove |
| --- | --- | --- | --- |
| Syntax/negative control | GitHub-hosted Ubuntu/Windows; Node 22/24 | Every repository JS file parses and a deliberately malformed file is rejected | Runtime behavior |
| Existing upstream unit suite | Mocha/NYC; Ubuntu/Windows Node 22 | Address parser, S7 item encoding/decoding, serializer/parser and in-memory S7Connection fixtures | Full network or real PLC |
| Read-only API smoke | Imported package after dependency install | Exported names and package metadata remain accessible | Connection, release identity, controller support |
| Real S7Comm protocol | Future separate PR; disposable loopback S7 server | Real COTP handshake, typed read/write against synthetic DB, reconnect | Siemens CPU/firmware compatibility |
| Fault injection | Future separate PR; controlled local TCP peers | Blackholed/late COTP, TCP RST, disconnect, bounded cleanup | All field networks |
| Physical HIL | Future, explicitly approved isolated S7-1200 | Named hardware, firmware, program SHA, Git SHA and safe pre/post checks | Universal support |

**Baseline:** `ec89d6b8c7b71fbc83c308c44bbcb6d078998201`, upstream package `@st-one-io/nodes7@1.1.2`. Historical tests existed but this fork had no independent CI at creation. The inherited `package-lock.json` advertises version 1.1.0 and v1; bootstrap therefore runs `npm install --no-package-lock --ignore-scripts` *only as an explicitly temporary baseline*, not a reproducible resolution. Replace it in a separate reviewed PR with integrity-locked `npm ci` tested on both OSes; preserve failing-bootstrap evidence and independent verification.

The protected package-smoke job is a final aggregate gate: it fails unless the full syntax matrix and both unit suites succeed. A test that never started is a failure. Do not suppress known red behavior to obtain green results.

The immediately next protocol change should import/adapt evidence from [wrapper #10](https://github.com/Missel2/node-red-contrib-s7/pull/10) and [wrapper #13](https://github.com/Missel2/node-red-contrib-s7/pull/13) to test this package directly: blackhole after the 22-byte COTP request, forced disconnect during pending handshake, watchdog timeout, late handshake, TCP RST, repeated cycles and fixture-independent client/peer close measurement. Require fail-before/pass-after for the *same test* on a corrected head, and preserve real protocol roundtrips. Do not copy or claim tests that have not been executed here.

No CI runner in this bootstrap has network access to Siemens hardware. HIL is pending; see `HIL_TEST_MATRIX.md`.
