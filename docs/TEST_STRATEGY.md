# Test strategy and confidence levels

| Layer | Environment | Evidence | What it does not prove |
| --- | --- | --- | --- |
| Syntax/negative control | GitHub-hosted Ubuntu/Windows; Node 22/24 | Every repository JS file parses and a deliberately malformed file is rejected | Runtime behavior |
| Existing upstream unit suite | Mocha/NYC; Ubuntu/Windows Node 22 | Address parser, S7 item encoding/decoding, serializer/parser and in-memory S7Connection fixtures | Full network or real PLC |
| Read-only API smoke | Imported package after dependency install | Exported names and package metadata remain accessible | Connection, release identity, controller support |
| Real S7Comm protocol | Future separate PR; disposable loopback S7 server | Real COTP handshake, typed read/write against synthetic DB, reconnect | Siemens CPU/firmware compatibility |
| Fault injection | Future separate PR; controlled local TCP peers | Blackholed/late COTP, TCP RST, disconnect, bounded cleanup | All field networks |
| Physical HIL | Future, explicitly approved isolated S7-1200 | Named hardware, firmware, program SHA, Git SHA and safe pre/post checks | Universal support |

**Baseline:** `ec89d6b8c7b71fbc83c308c44bbcb6d078998201`, upstream package `@st-one-io/nodes7@1.1.2`. Historical tests existed but this fork had no independent CI at creation. The inherited lockfile v1 advertised root package version 1.1.0 rather than 1.1.2. **PR #1** established a temporary non-reproducible baseline, which was human-approved and squash-merged as `1cbacddd05cac82f5a70e14469bf21b901df6de1`. **Draft PR #11 / N7-002** replaces the lockfile with registry-generated v3 and changes the existing protected Ubuntu/Windows Node 22 unit jobs to `npm ci --ignore-scripts --no-audit --no-fund`. The package-smoke requires both hosted OS jobs and syntax matrix. `scripts/ci/verify-lockfile.cjs` checks the committed manifest, dependency tree, registry resolution, integrities and seven intentionally corrupted negative controls. These claims apply to the PR only until human-approved merge.

The protected package-smoke job is a final aggregate gate: it fails unless the full syntax matrix and both unit suites succeed. A test that never started is a failure. Do not suppress known red behavior to obtain green results.

The immediately next protocol change should import/adapt evidence from [wrapper #10](https://github.com/Missel2/node-red-contrib-s7/pull/10) and [wrapper #13](https://github.com/Missel2/node-red-contrib-s7/pull/13) to test this package directly: blackhole after the 22-byte COTP request, forced disconnect during pending handshake, watchdog timeout, late handshake, TCP RST, repeated cycles and fixture-independent client/peer close measurement. Require fail-before/pass-after for the *same test* on a corrected head, and preserve real protocol roundtrips. Do not copy or claim tests that have not been executed here.

No CI runner in this bootstrap has network access to Siemens hardware. HIL is pending; see `HIL_TEST_MATRIX.md`.

## Discovered inherited timezone assumption (2026-11-08)

The first exact-head Ubuntu and Windows Node 22 CI runs reached 237 passing upstream tests and **four failing S7Item DT/DTL read/write assertions**. The fixtures assume UTC-03 (e.g. a local 18:02 becomes 21:02Z), but the initial hosted CI deliberately set `TZ=UTC`. Both OSes failed the same four assertions. The temporary baseline harness now explicitly sets `TZ=America/Sao_Paulo`, and checks the actual offset at both fixture dates before running tests. This is an **environment characterization**, not a production date-conversion fix or evidence of timezone-independent behavior. N7-009 will define a timezone-independent date contract and validate across zones in a separate PR. Do not alter legacy assertions silently.

## N7-002 cross-platform clean dependency installation

- Original manifest: `@st-one-io/nodes7@1.1.2`, runtime `iso-on-tcp@^0.1.0`. Lockfile conversion generated in [GitHub-hosted candidate run 42515794589](https://github.com/Missel2/nodes7/actions/runs/42515794589), 336 package entries and SHA-256 `a360688c4e9c3aac80daf5c7bbe8d40de5ea6993388a393f3d33a92fb8142fc8` of candidate bytes.
- All five directly declared dependencies keep their old exact resolved versions; npm v1-to-v3 conversion supplied real resolved npm package metadata. Some transitive entries retain legacy `sha1-` integrity. Do not equate valid Subresource Integrity or a green `npm ci` with an audited, vulnerability-free dependency tree.
- `npm ci` validates downloaded tarballs against committed integrity strings and fails on an unsynchronized manifest/lockfile. No `npm install` fallback is permitted in the proposed protected CI.
- The test suite retains the documented `America/Sao_Paulo` (UTC−03 at fixture dates) requirement. That temporary environment pin is **not** a fix for timezone independence (N7-009).
- No source implementation, real S7Comm wire tests, hardware checks or npm publication is added by N7-002.
