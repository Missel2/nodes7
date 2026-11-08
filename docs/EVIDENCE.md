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

**Not recorded as green until new workflow runs complete on the exact head.** Update this section during review with commit SHA, run URLs, number of checks, failures and open limitations. Only syntax, inherited unit tests, API import and package dry-run are in scope; no actual S7Comm network fixture or HIL is executed by this bootstrap. A correctly versioned lockfile is **not** in this PR.

No npm publication, deployment, actual PLC activity or safety certification has occurred.
