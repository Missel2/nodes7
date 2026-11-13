## Release preparation update — 2026-11-13 (development only)

- Protected nodes7 `master` is `1c24ed354da03748013b69bb415186aed43f034d`,
  after separate human-approved and post-merge-verified PRs #31 and #33.
- Proposed **UNPUBLISHED** `@missel2/nodes7@0.1.0-alpha.2` is prepared
  in [Draft PR #34](https://github.com/Missel2/nodes7/pull/34) on
  `release/n7-alpha2-readonly-candidate-20261113`, without a merge,
  staging/publication, dist-tag change, GitHub tag/release, or external PLC
  connection. Published `alpha.1` remains immutable.
- A test-only original-red commit `554137053be6a7c1f7a1eddcdfadc0b649f42163`
  proved the alpha.1 identity must be rejected: both Ubuntu/Windows Node 22
  public-contract tests correctly failed, while their previous 299 unit tests
  passed; the initial release preflight showed two version-guard failures.
- The candidate exposed a real cross-platform reproducibility issue:
  Windows initially checked out CRLF for packed sources and created a
  different tarball digest. Canonical LF `.gitattributes` and an enforced
  cross-OS SHA-256/SHA-512 comparison now guard release packaging.
  Earlier candidate head `0fbfaef3690ac0aa87622de4b2c19a1b9a8e971d`
  achieved matching archive SHA-256
  `11327c208ad99dae5eca2fd4a6fd9a83e17637b8eb4ad1f2018c6ba98bd6c81e`
  and **17/17** successful checks. **Revalidate after this docs commit.**
- Candidate identity (root manifest+lock) retains the **same 336 resolved**
  dependency entries and the previous runtime `iso-on-tcp@0.1.0`. Its
  read-only preflight must verify all archive and SBOM hashes on its final
  exact head; a new Windows/Linux **packed** consumer CI installs the actual
  tarball in a disposable environment. CI is evidence, not release approval.
- [ALPHA2_RELEASE_NOTES.md](ALPHA2_RELEASE_NOTES.md) describes protocol
  behavior changes, risk boundaries and remaining issues; [RELEASE_PREFLIGHT.md](RELEASE_PREFLIGHT.md)
  defines separate source merge, npm stage, npm stage approval and downstream
  Contrib alias/lock gates. The existing [Contrib Draft PR #52](https://github.com/Missel2/node-red-contrib-s7/pull/52)
  is release planning only, not a dependency change.
- No physical HIL-S7-001..007 performed; no OT network, Node-RED host
  patch, automatic merge or npm registry write authorized by this work.

---

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
- The `ae8420dde11e2cf4f34e95ce23d5f4c45cc36b3a` implementation head passed all **13/13** check runs. **This evidence-only documentation commit changes the head; reverify exact-head CI before requesting a separate explicit approval for PR #13.** A green implementation does not authorize an automatic merge.

## Remaining
- Physical Siemens S7-1200 HIL (HIL-S7-001..007) all `PENDING_HARDWARE`. Synthetic Snap7 is not Siemens firmware. No production OT or physical writes.
- N7-003 added a **real parsed 22-byte COTP CC callback race** in `test/network/cotp-cc-race.test.cjs`: `raw-message` decoding is confirmed, the endpoint disconnects, and the underlying ISO-on-TCP client's already-queued `connect` callback fires afterward without reviving S7Conn. On Ubuntu and Windows, all 0+0 socket counts and strict event counts passed. Evidence: Verification run `42519777698` / CodeQL `42519777739`, head `ae8420dde11e2cf4f34e95ce23d5f4c45cc36b3a`, Ubuntu artifact `13632628121`, Windows artifact `13632633246`. Separate queued-CC-before-disconnect test verifies safe cleanup without claiming delivery after socket close.
- N7-006 old dependency security triage; N7-009 timezone-independent S7 DT/DTL semantics; further fault duration/soak work. CI status does not mean industrial safety certification.
- Only **after** a human-approved nodes7 fix merge: independently pin revised dependency in `Missel2/node-red-contrib-s7`, rerun the wrapper's ten original-red/corrected-green lifecycle tests and wire protocol CI, and obtain separate approval for its PR. No npm publish until identity/license/release decision.

**No automatic merges, direct pushes to master, package publishing, cluster sync or production deployments.** Every subsequent PR has its own approval gate.
