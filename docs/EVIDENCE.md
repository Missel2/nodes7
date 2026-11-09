# Evidence ledger

## Observed before first nodes7 bootstrap PR

- Fork `Missel2/nodes7` exists, same `master` SHA as upstream `st-one-io/nodes7`: `ec89d6b8c7b71fbc83c308c44bbcb6d078998201` (8 Nov 2026).
- Inherited source claims package `@st-one-io/nodes7@1.1.2`; its root `package-lock.json` identifies `1.1.0`, format v1. Reproducible dependency installation **not established**.
- No workflows, independently verified CI runs or protected `master` ruleset in this fork at the time of investigation. Repository Issues disabled.
- Source and unit tests are inherited from upstream; **test files existing is not test execution evidence**.

## External evidence (not nodes7 fork verification)

- [Sibling wrapper Issue #2](https://github.com/Missel2/node-red-contrib-s7/issues/2): actual `@st-one-io/nodes7@1.1.2`, blackholed COTP on loopback, three trials per hosted OS; the Node client socket and peer remained open after watchdog timeout and public disconnect, prior to fixture-forced cleanup.
- [Sibling PR #10](https://github.com/Missel2/node-red-contrib-s7/pull/10) and [PR #13](https://github.com/Missel2/node-red-contrib-s7/pull/13): green **diagnostic/expected-red** CI, not leak correction. No Siemens hardware test.

## Current bootstrap PR evidence

Historical record: [PR #1](https://github.com/Missel2/nodes7/pull/1) eventually passed [Verification run 42513556248](https://github.com/Missel2/nodes7/actions/runs/42513556248) and [CodeQL run 42513556160](https://github.com/Missel2/nodes7/actions/runs/42513556160) on head `b1469b58b7768813cde534ef95df1eac32e9029b` (all nine check runs successful), and was explicitly authorized for squash merge to `master` as `1cbacddd05cac82f5a70e14469bf21b901df6de1`. The bootstrap included only syntax, inherited unit tests, API import and package dry-run; no S7Comm wire/hardware tests and **no lockfile repair**.

No npm publication, deployment, actual PLC activity or safety certification has occurred.

## Initial exact-head CI failure (before fixture timezone correction)

Workflow [42513382879](https://github.com/Missel2/nodes7/actions/runs/42513382879), head `fdf4bf3f1d465b6ea4ac93af5dd05e3f9646fbf2`: all four syntax/negative-control matrix jobs succeeded. Both Windows and Ubuntu Node 22 unit jobs produced **237 passing and four failing DT/DTL date conversions**, solely because the historical fixtures expected UTC-03 while the initial workflow set UTC. The job preserved coverage artifacts. This is not evidence of a code fix; see `docs/TEST_STRATEGY.md` and N7-009. Follow-up commit pins an explicit checked fixture timezone and requires fresh exact-head CI.

## N7-001 completion and N7-002 candidate (2026-11-08)

- N7-001: [PR #1](https://github.com/Missel2/nodes7/pull/1) was explicitly approved and squash-merged; resulting `master` SHA `1cbacddd05cac82f5a70e14469bf21b901df6de1`. Original head `b1469b58b7768813cde534ef95df1eac32e9029b` passed [Verification 42513556248](https://github.com/Missel2/nodes7/actions/runs/42513556248) (7/7 jobs) and [CodeQL 42513556160](https://github.com/Missel2/nodes7/actions/runs/42513556160). No S7 runtime source changes.
- N7-002 [Issue #10](https://github.com/Missel2/nodes7/issues/10) / [draft PR #11](https://github.com/Missel2/nodes7/pull/11): [temporary generator job 128838401082](https://github.com/Missel2/nodes7/actions/runs/42515794589/job/128838401082) succeeded on GitHub-hosted Ubuntu Node 22. Converted inherited v1 to v3 by fetching real npm registry metadata, then successful clean `npm ci`, 241 inherited tests and 2 API checks. 336 package entries; lockfile SHA-256 `a360688c4e9c3aac80daf5c7bbe8d40de5ea6993388a393f3d33a92fb8142fc8`. All five direct dependency versions unchanged (including iso-on-tcp 0.1.0).
- Dependency risks: inherited packages include deprecated/vulnerable-potential transitive versions (e.g. glob 7.1.6, flat 4.1.0, old debug), and some SHA-1 integrities. A separate dependency vulnerability review is **required**; this PR only repairs deterministic installation.
- **N7-002 implementation evidence (checked head `2812b7363a104ce164531b916bcef57f99c2b975`):** [Verification 42516191766](https://github.com/Missel2/nodes7/actions/runs/42516191766) succeeded for all 7 jobs, including Ubuntu/Windows Node 22 `npm ci --ignore-scripts --no-audit --no-fund`, 241 inherited tests and 2 API checks on each OS, 4/4 syntax/negative controls (Node 22/24), and final protected aggregate package smoke with successful dry-run package inspection. Each host's metadata script validated 336 locked packages (57 with legacy SHA-1 SRI) and rejected 7/7 deliberately broken lockfiles. [CodeQL 42516191669](https://github.com/Missel2/nodes7/actions/runs/42516191669) succeeded (one analysis job; total nine passing commit checks). Exact test command and run links are retained in Actions.

**Dependency preservation audit:** The full inherited v1 dependency tree contains 336 resolved package instances and 302 distinct `name@version` combinations. The generated v3 lockfile contains exactly the same 336 package instances and 302 distinct `name@version` combinations, with **no additions, removals or resolved version changes**. Npm supplied missing registry metadata and fixed root version 1.1.0 -> 1.1.2. This is not a vulnerability review, and the 57 legacy SHA-1 integrity entries remain separately tracked.

Historical record: PR #11 received explicit independent user merge approval, passed 9/9 final exact-head checks on `05f6c789795d590e05462449e7f789360b6295ff`, and was squash-merged as `f201bcc0acdad4742e4066fa084577f23e396ce1`. Issue #10 is closed as completed. Runtime source remained unchanged.

## N7-003 exact original-red characterization (test-only; no runtime fix)

On [test-only commit ad5aba8896efc0e6fbce6b7ad538cba07fc342a9](https://github.com/Missel2/nodes7/commit/ad5aba8896efc0e6fbce6b7ad538cba07fc342a9), [run 42517268232](https://github.com/Missel2/nodes7/actions/runs/42517268232) produced **2/2 successful original-red diagnosis jobs** (Ubuntu 24.04 and Windows 2025 Node 22), each proving **two specifically named failing assertions** on the unchanged fork's actual `src/s7endpoint.js`: early public disconnect and 10s watchdog failed to close the real 22-byte COTP/TCP peer. Both runs record machine-readable socket state **before fixture cleanup**, and reject generic harness timeout or skipped test as success. Artifacts [Ubuntu 13632176195](https://github.com/Missel2/nodes7/actions/runs/42517268232/artifacts/13632176195) and [Windows 13631039370](https://github.com/Missel2/nodes7/actions/runs/42517268232/artifacts/13631039370).

**The above successful expected-red gate means defect reproduced, NOT fixed.** Subsequent candidate branch must retain this original SHA as an immutable red baseline, run the exact same tests green on the candidate, and link fresh exact-head CI evidence. Physical Siemens HIL remains unexecuted.

## N7-003 direct source candidate proof and security review (2026-11-08)

- **Original-red immutable baseline:** `master` at `f201bcc0acdad4742e4066fa084577f23e396ce1`. Script extracts the original `src/s7endpoint.js` using `git show` into an atomically created, `wx`-exclusive temporary file under `src` so its own dependencies are resolved normally; no monkey patch of production. Two **identical** `node:test` cases fail the intended public behavior assertions.
- **Initial independent original-red:** [run 42517268232](https://github.com/Missel2/nodes7/actions/runs/42517268232) had green *diagnostic expected-red* gates on both Ubuntu and Windows. That is **not** the fix.
- **Implementation head `a64123a7bd78ea29d913b39bbf57424b7446a7ca`:** [Verification 42518378160](https://github.com/Missel2/nodes7/actions/runs/42518378160) **11/11 successful jobs**; [CodeQL 42518378259](https://github.com/Missel2/nodes7/actions/runs/42518378259) **1/1 successful job**; 13/13 visible commit checks successful. This records the candidate behavior *before* the final evidence/stricter-assertion commit, which must itself receive fresh checks.
- **Artifact-by-artifact comparison, Ubuntu and Windows (Node 22):** [Ubuntu archive 13632083740](https://github.com/Missel2/nodes7/actions/runs/42518378160/artifacts/13632083740), [Windows archive 13632895013](https://github.com/Missel2/nodes7/actions/runs/42518378160/artifacts/13632895013). Both archive original baseline and candidate JSON + TAP separately. On each OS, both failures start from **one actual 22-byte COTP CR**, with **1 open client TCP handle and 1 open peer TCP socket before fixture cleanup**. On candidate, each produces **0 open client handles and 0 live peer sockets before fixture cleanup**.
- **Early disconnect:** original `disconnect()` / connect promise still pending after bounded windows; candidate `disconnect()` fulfilled, peer close observed, connect promise rejected with `ERR_CONNECTION_CLOSED`, zero false `connect` events.
- **Native watchdog:** both original and candidate connect promises reject with `ERR_TIMEOUT` after the 10-second transport watchdog. Original retains 1+1 open client/peer; candidate closes both before fixture cleanup and subsequent public `disconnect()` fulfills.
- **Repeated calls:** 6/6 real loopback COTP attempts on each OS have settled public disconnect, rejected pending connect, peer socket closure and no false connected status; no peer socket survived any of the six pre-cleanup checkpoints. Late **custom-transport Promise** resolution is destroyed and never promoted to active connection; this test is a *synthetic delayed custom transport*, not proof of a late RFC1006 confirmation.
- **Real protocol regression:** `python-snap7==3.3.1` on ephemeral/disposable localhost or assigned test ports successfully performed *actual classic S7Comm* COTP setup, typed `DB1` REAL/INT read, synthetic REAL write/readback, **two server restarts with client reconnect**, peer abort and explicit TCP RST. [Ubuntu and Windows logs in Verification 42518378160](https://github.com/Missel2/nodes7/actions/runs/42518378160) report all 4/4 protocol tests passed per OS. This is **not Siemens firmware**, PLCSIM or a production control system.
- **Security gate resolved:** a new high CodeQL `js/file-system-race` finding was raised on the first candidate in the *test negative-control script* (check-then-create temporary file). The code was changed to atomic exclusive `fs.writeFileSync(..., {flag:'wx',mode:0o600})` with conditional cleanup of files created by this process. Final reviewed implementation head has **CodeQL check success**; no alert was ignored or waived.
- **Not yet qualified:** arbitrary delayed CC arriving only **after the client TCP socket has fully closed** cannot be observed as a parsed frame; the controlled in-flight case checks safe closure but does not assert that frame was decoded. Long-duration soak, unusual untested timing, physical S7-1200/1500 compatibility and production OT are also not established; HIL-S7-001/-002/-003/-005 remain `PENDING_HARDWARE`. No npm release, wrapper dependency switch or production deployment.

Final candidate source is still in a **draft PR** and has **not been merged**. Explicit human approval must be obtained for PR #13 after exact-head CI, diff and risk checks.

## N7-003 actual late-COTP CC callback race (2026-11-08)

**Implementation test head `ae8420dde11e2cf4f34e95ce23d5f4c45cc36b3a`:**
- [Verification 42519777698](https://github.com/Missel2/nodes7/actions/runs/42519777698): **11/11 jobs successful**. [CodeQL 42519777739](https://github.com/Missel2/nodes7/actions/runs/42519777739): **1/1 job successful**. GitHub reported **13/13 check-runs successful**, including the protected seven Verification checks, the CodeQL analysis and PR security result, and the new internal COTP and real S7Comm jobs.
- Test source: `test/network/cotp-cc-race.test.cjs` imports the *real* fork `S7Endpoint` and installed `iso-on-tcp` parser. The disposable peer captures a real 22-byte COTP CR, constructs the complete 22-byte RFC1006 CC reply (TPDU 0xD0), independently validates it through `ISOOnTCPParser`, then sends it over a real TCP socket bound to `127.0.0.1`.
- **Deterministic asynchronous race:** The real `ISOOnTCPClient` decodes the CC TPDU and schedules its internal `connect` callback. The test invokes public `endpoint.disconnect()` from its already-scheduled `raw-message` event, **before** the internal connect callback runs. The internal callback is verified to fire **once after cancellation**; the fork's generation guard must not promote this stale transport into an `S7Connection`.
- **Verified raw JSON archives**, [Ubuntu 13632628121](https://github.com/Missel2/nodes7/actions/runs/42519777698/artifacts/13632628121) and [Windows 13632633246](https://github.com/Missel2/nodes7/actions/runs/42519777698/artifacts/13632633246), Node `v22.23.4`, exactly agree: `decodedCCCount=1`, `lateIsoConnectCallbacksAfterCancel=1`, `endpointConnectEvents=0`, `endpointDisconnectEvents=1`, `s7ConnectionCreated=false`, `endpoint.isConnected=false`, `clientStreamClosed=true`, **0 client socket handles and 0 peer sockets before fixture cleanup**. Public disconnect fulfills, pending connect rejects with `ERR_CONNECTION_CLOSED`. **This proves an actual parsed CC and delayed internal callback, not merely a delayed synthetic transport promise.**
- **Independent queued-in-flight test:** The TCP peer writes a valid 22-byte CC immediately before public disconnect, with no awaiting between those operations. Both hosts confirm prompt public disconnect, pending connect rejected, no false endpoint connect and **0+0 live client/peer sockets** before test cleanup. This case **does not claim that the client parsed the queued CC after closing**; the prior deterministic parsed-CC case establishes the relevant internal callback race.
- **No regressions:** the same exact-head required aggregate still gates both operating systems' two original-red/candidate-green timeout/early-disconnect assertions, six COTP cancellation cycles, late customTransport fulfillment, `python-snap7==3.3.1` synthetic DB read/write/restart/abort/RST (4/4 on each OS), the two 241-test upstream suites, syntax checks and CodeQL.
- **Remaining risk:** true industrial Siemens firmware/HIL untested, extended duration and unusual network timing not exhaustively covered, visible public `connect()` cancellation rejection is a breaking behavioral change for consumers that relied on the old unresolved promise. No npm publish or Node-RED wrapper integration. A separate maintainer approval is still needed to merge PR #13.

The documentation update above creates a **new commit**; only final exact-head CI on that new SHA authorizes describing this PR as fully green for human review. Do not auto-merge.

## N7-010 post-destroy queue admission (2026-11-09)

Baseline `2cf864e38be447c2709348a25eb0524d67f5cf2d`; issue #14.
Test-only commit `a1bed12` preserves the unchanged runtime and adds one regression
in `test/s7/s7connection.spec.js`. On Linux Node v24.22.1,
`./node_modules/.bin/mocha --grep 'post-destroy' test/s7/s7connection.spec.js`
fails exactly the queue assertion (actual 1, expected 0) after the expected
`ERR_ILLEGAL_STATE` rejection. The same test passes with one early return after
that rejection. It checks 32 rejected requests, zero retained jobs and zero bytes.
`TZ=America/Sao_Paulo npm test` then passes 242 tests. No original assertion was
weakened. These are local in-memory tests, not Windows, wire or hardware proof.
Hosted exact-head CI remains required; see the linked PR for its eventual result.
HIL: not applicable to post-destroy in-memory queue admission. No release.
