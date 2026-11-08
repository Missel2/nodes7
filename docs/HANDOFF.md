# Development handoff — nodes7

## Completed (human-approved merges)
- Governance/CI: [PR #1](https://github.com/Missel2/nodes7/pull/1) squash `1cbacddd05cac82f5a70e14469bf21b901df6de1`.
- N7-002 reproducible npm lock: [PR #11](https://github.com/Missel2/nodes7/pull/11) squash `f201bcc0acdad4742e4066fa084577f23e396ce1` (336 identical package instances, real npm registry lockfile v3, Ubuntu/Windows `npm ci`, seven lock negative controls; original 57 SHA-1 SRI and old package vulnerabilities remain separate risk). Issue #10 closed.
- Master is protected by active `protect-master` with eight required status checks, resolved threads, no bypass and no auto-merge. Never direct-push.

## Current N7-003 (NOT MERGED)
- Issue [#12](https://github.com/Missel2/nodes7/issues/12) and [draft PR #13](https://github.com/Missel2/nodes7/pull/13), branch `test/n7-003-cotp-pending-transport-red-20261108`. Master remains `f201bcc0...`.
- Candidate modifies **only** `src/s7endpoint.js` runtime code: tracks pending TCP stream before ISO-on-TCP COTP completion, destroys it on error/timeout/manual disconnect, cancels connection watchdog, rejects cancelled public `connect()`, drops late transport results and avoids stale `connecting` event.
- Original code is pinned by full immutable baseline SHA `f201bcc0...` and independently run against **the exact same two test cases**; only exact original-red and candidate-green results satisfy the cross-platform gate. Reports are archived before test peer socket teardown.
- Extended CI runs on hosted Windows/Ubuntu Node 22 and includes real `python-snap7==3.3.1` synthetic DB1 S7Comm read/write/restart/abort/RST, plus six cancellation cycles and late custom-transport result destruction. The *required* existing aggregate package-smoke depends on **every** cross-platform protocol job.
- Prior implementation head `a64123a7bd78ea29d913b39bbf57424b7446a7ca` passed [Verification 42518378160](https://github.com/Missel2/nodes7/actions/runs/42518378160) (11/11 jobs), [CodeQL 42518378259](https://github.com/Missel2/nodes7/actions/runs/42518378259) (1/1 job), 13/13 commit checks. Original client+peer = 1+1 open; candidate client+peer = 0+0 on both OSes. Six repeated COTP cancels per OS green. An initial CodeQL high `js/file-system-race` was FIXED with exclusive `wx` creation; no alerts bypassed.
- **The last documentation/assertion commit must be separately verified on its own SHA; historical green checks do not suffice.** Review the complete diff and risk/rollback, then request **explicit new user permission** to merge PR #13. Do not merge automatically.

## Remaining
- Physical Siemens S7-1200 HIL (HIL-S7-001..007) all `PENDING_HARDWARE`. Synthetic Snap7 is not Siemens firmware. No production OT or physical writes.
- Real late COTP handshake confirmation race after cancellation still needs independent targeted coverage; customTransport late fulfillment is tested but is a distinct case.
- N7-006 old dependency security triage; N7-009 timezone-independent S7 DT/DTL semantics; further fault duration/soak work. CI status does not mean industrial safety certification.
- Only **after** a human-approved nodes7 fix merge: independently pin revised dependency in `Missel2/node-red-contrib-s7`, rerun the wrapper's ten original-red/corrected-green lifecycle tests and wire protocol CI, and obtain separate approval for its PR. No npm publish until identity/license/release decision.

**No automatic merges, direct pushes to master, package publishing, cluster sync or production deployments.** Every subsequent PR has its own approval gate.
