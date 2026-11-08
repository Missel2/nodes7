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

Any future commit (including this evidence-only documentation update) requires fresh **exact-head** CI checks. PR #11 is still a draft and is **not authorized for merge**; protected `master` remains on the previous squash SHA until human approval.

## N7-003 exact original-red characterization (test-only; no runtime fix)

On [test-only commit ad5aba8896efc0e6fbce6b7ad538cba07fc342a9](https://github.com/Missel2/nodes7/commit/ad5aba8896efc0e6fbce6b7ad538cba07fc342a9), [run 42517268232](https://github.com/Missel2/nodes7/actions/runs/42517268232) produced **2/2 successful original-red diagnosis jobs** (Ubuntu 24.04 and Windows 2025 Node 22), each proving **two specifically named failing assertions** on the unchanged fork's actual `src/s7endpoint.js`: early public disconnect and 10s watchdog failed to close the real 22-byte COTP/TCP peer. Both runs record machine-readable socket state **before fixture cleanup**, and reject generic harness timeout or skipped test as success. Artifacts [Ubuntu 13632176195](https://github.com/Missel2/nodes7/actions/runs/42517268232/artifacts/13632176195) and [Windows 13631039370](https://github.com/Missel2/nodes7/actions/runs/42517268232/artifacts/13631039370).

**The above successful expected-red gate means defect reproduced, NOT fixed.** Subsequent candidate branch must retain this original SHA as an immutable red baseline, run the exact same tests green on the candidate, and link fresh exact-head CI evidence. Physical Siemens HIL remains unexecuted.
