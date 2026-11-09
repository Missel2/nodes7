**Verified repository snapshot: 2026-11-09; baseline `2cf864e38be447c2709348a25eb0524d67f5cf2d`.** PR #13 is merged: pending COTP transport cancellation and software wire tests are on master. The wrapper pins this exact source archive through its merged PR #15. This is software evidence, not a published fork release or physical Siemens qualification.

Current navigation: [work index](WORK_INDEX.md), [review](PROJECT_REVIEW.md).
Historical sections below retain the status of their named revision; they do not override this snapshot.

---

# Test strategy and confidence levels

| Layer | Environment | Evidence | What it does not prove |
| --- | --- | --- | --- |
| Syntax/negative control | GitHub-hosted Ubuntu/Windows; Node 22/24 | Every repository JS file parses and a deliberately malformed file is rejected | Runtime behavior |
| Existing upstream unit suite | Mocha/NYC; Ubuntu/Windows Node 22 | Address parser, S7 item encoding/decoding, serializer/parser and in-memory S7Connection fixtures | Full network or real PLC |
| Read-only API smoke | Imported package after dependency install | Exported names and package metadata remain accessible | Connection, release identity, controller support |
| Real S7Comm protocol | Future separate PR; disposable loopback S7 server | Real COTP handshake, typed read/write against synthetic DB, reconnect | Siemens CPU/firmware compatibility |
| Fault injection | Future separate PR; controlled local TCP peers | Blackholed/late COTP, TCP RST, disconnect, bounded cleanup | All field networks |
| Physical HIL | Future, explicitly approved isolated S7-1200 | Named hardware, firmware, program SHA, Git SHA and safe pre/post checks | Universal support |

**Baseline:** `ec89d6b8c7b71fbc83c308c44bbcb6d078998201`, upstream package `@st-one-io/nodes7@1.1.2`. Historical tests existed but this fork had no independent CI at creation. The inherited lockfile v1 advertised root package version 1.1.0 rather than 1.1.2. **PR #1** established temporary baseline CI and was squash-merged as `1cbacddd05cac82f5a70e14469bf21b901df6de1`. **N7-002 PR #11** then generated a registry-backed v3 lockfile with unchanged dependency versions; its real cross-platform `npm ci --ignore-scripts --no-audit --no-fund` + seven invalid-lock negative controls were verified and **explicitly human-approved/squash-merged** as `f201bcc0acdad4742e4066fa084577f23e396ce1`. The protected package-smoke aggregates syntax, unit and future protocol jobs.

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

## N7-003 direct-source fault proof in draft PR #13

- Real disposable TCP, **not a mocked `nodes7` transport**, is used for two blackholed 22-byte RFC1006 COTP connection requests. The same test source is invoked against both the pinned broken `src/s7endpoint.js` (must fail two named assertions) and candidate library source (must pass both) on Windows/Linux Node 22.
- The test fixture records active client handles and open peer sockets, connection result/error, `disconnect()` completion and event counts **before** destroying any peer itself. The protected package-smoke requires both original-red/candidate-green OS jobs, and failure/skip/harness timeout is not counted as success.
- Real network protocols are further tested using **`python-snap7==3.3.1` local S7Comm server**, with typed reads, synthetic DB1 scratch writes/readback, two restarts, TCP RST and early COTP abort on both OSes. This is genuine classic S7Comm over localhost, but it is **not real Siemens firmware or hardware validation**.
- Six repeated early disconnect cycles per host and a separate synthetic customTransport delayed completion test cover reentrancy and late result disposal. `test/network/cotp-cc-race.test.cjs` now adds **real RFC1006/COTP CC TPDU** from an actual loopback peer: the ISO-on-TCP parser must decode it, public disconnect runs before an already-queued native client connect callback, and that callback must later execute without activating `S7Connection` or leaving sockets. A second queued-CC case covers immediate cancel after the peer sends valid CC; it does not assert a post-close frame was delivered. Both run within the protected cross-platform COTP job. Long-run leak soak, physical Siemens HIL and arbitrary post-socket-close delivery remain outside current evidence.
- See `docs/EVIDENCE.md` for exact SHA/run links and the independently inspected Windows/Ubuntu JSON artifacts. PR #13 is not merged and still requires explicit authorization.
