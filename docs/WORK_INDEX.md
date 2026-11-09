# Work index

**Verified repository snapshot: 2026-11-09; baseline `2cf864e38be447c2709348a25eb0524d67f5cf2d`.** PR #13 is merged: pending COTP transport cancellation and software wire tests are on master. The wrapper pins this exact source archive through its merged PR #15. This is software evidence, not a published fork release or physical Siemens qualification.


Shared execution order and release checklist: [ecosystem roadmap issue #21](https://github.com/Missel2/node-red-contrib-s7/issues/21).
[Repository review](PROJECT_REVIEW.md) explains findings, evidence and review limits.

| Work | State | Next evidence |
| --- | --- | --- |
| N7-001 / N7-002: governance and locked install | Merged #1 / #11 | Maintain existing protected checks |
| N7-003 / N7-004: COTP cancellation and wire tests | Merged #13; software verified | Extended faults remain #16; HIL pending |
| N7-010: rejected requests retained after destroy | [Issue #14](https://github.com/Missel2/nodes7/issues/14), [PR #18](https://github.com/Missel2/nodes7/pull/18), unmerged | Same-test red/green; exact-head Windows/Linux and CodeQL |
| N7-005 / N7-006: scoped quality and dependency review | [Issue #15](https://github.com/Missel2/nodes7/issues/15) | Triage existing Dependabot #2–#9; distinguish runtime/tooling exposure |
| N7-008 / N7-011: protocol boundaries and endurance | [Issue #16](https://github.com/Missel2/nodes7/issues/16) | Replayable faults, independent byte vectors, measured bounded recovery |
| N7-009: date semantics | [Issue #17](https://github.com/Missel2/nodes7/issues/17) | Explicit local/UTC contract, cross-zone vectors |
| N7-007: physical S7-1200 | [Shared bench](https://github.com/Missel2/node-red-contrib-s7/issues/8) | PENDING_HARDWARE |

## Continuation

Check live branches, PRs, review threads and exact-commit CI before changing status.
A merged library change does not update the wrapper's immutable dependency pin.
Keep at most three implementation workstreams active. Never replace pending or
expired evidence with assumed success. No automatic merge, release or hardware access.
