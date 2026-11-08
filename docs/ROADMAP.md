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
