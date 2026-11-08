# Roadmap — evidence-driven protocol maintenance

**Starting point (2026-11-08):** fork unchanged from upstream `ec89d6b8`, no own CI, no rulesets, Issues disabled. This is a plan, not a record of completed tests.

## P0 — Establish independently verifiable baseline

- Bootstrap PR: provenance, AI/human maintenance, safety gates, read-only contract and hosted Ubuntu/Windows CI; no runtime changes.
- Human enables Issues and configures an active `protect-master` ruleset only after matching workflow checks exist.
- Separate lockfile PR: correct root lockfile for package version 1.1.2, real integrity hashes, exact dependency tree and verified cross-OS `npm ci`; don't change runtime versions in same PR.
- Add focused static-quality checks and security review without mass refactoring legacy code.

## P0 — Close leaking COTP transport during partial setup

- Port and independently rerun blackhole/early-disconnect characterization from the Node-RED wrapper work.
- Require original-red/candidate-green assertion of **client and peer close without fixture-forced termination**, across timeout, disconnect, late handshake, RST and repeat cycles.
- Patch only the correct `nodes7` layer; measure event/listener/timer ownership; retain public behavior and wire read/write tests.
- Integrate corrected package into downstream Node-RED wrapper via pinned source/lock, test both repos. No npm publication until separate decision.

## P1 — Harden network and wire behavior

- Verify actual protocol read/write, network fault handling, reconnect and shutdown on disposable loopback fixtures.
- Review upstream PRs #14 (error handling), #19 (write packet framing), #21 (item packing) independently with red/green contracts. Never bulk-merge untested patches.
- Preserve tests for ambiguous write results and do not replay non-idempotent writes.

## P2 — Long-run reliability, compatibility and release candidates

- Record socket counts and bounded recovery under repeated faults.
- Maintain OS/Node matrix and compatibility commitments based on observed evidence.
- Introduce isolated S7-1200 HIL only after explicit bench and operator approval. See `HIL_TEST_MATRIX.md`.
- Decide fork package identity, signed artifacts, SBOM and controlled release only after qualifying the CI and hardware boundaries.

Every round begins with actual branches, PRs, CodeQL, required checks and current evidence. No auto-merge.

## 2026-11-08 implementation update (not a release)

- Bootstrap [PR #1](https://github.com/Missel2/nodes7/pull/1) passed hosted Windows/Linux checks and CodeQL, and was **human-approved, squash-merged** to `master` at `1cbacddd05cac82f5a70e14469bf21b901df6de1`. Ruleset `protect-master` is active with eight required status checks; Issues are enabled.
- N7-002 [Issue #10](https://github.com/Missel2/nodes7/issues/10) / [PR #11](https://github.com/Missel2/nodes7/pull/11): exact registry-backed v3 lockfile with all 336 resolved package versions unchanged, successful Ubuntu/Windows `npm ci`, seven negative controls, **explicitly human-approved/squash-merged** to `f201bcc0acdad4742e4066fa084577f23e396ce1`. Issue #10 closed.
- N7-003 [Issue #12](https://github.com/Missel2/nodes7/issues/12) / [draft PR #13](https://github.com/Missel2/nodes7/pull/13): actual fork source original-red/candidate-green, source-level pending stream ownership fix, six-cycle cleanup, real synthetic S7Comm read/write/restart/RST on both hosted OSes and CodeQL. Prior implementation head had 13/13 green checks. **Unmerged**, pending exact final-head checks, risk review and explicit human permission.
- True late COTP CC timing, long-duration soak, physical Siemens HIL and downstream wrapper dependency integration are **not** completed.
