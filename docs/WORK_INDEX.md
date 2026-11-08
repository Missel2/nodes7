# Work index (GitHub Issues now enabled)

| ID | Priority | Work | Exit evidence | State at fork/bootstrap |
| --- | --- | --- | --- | --- |
| N7-001 | P0 | CI/governance bootstrap | [PR #1](https://github.com/Missel2/nodes7/pull/1), 9 green checks | MERGED to master 1cbacddd |
| N7-002 | P0 | Rebuild inherited stale npm lockfile | [Issue #10](https://github.com/Missel2/nodes7/issues/10), [PR #11](https://github.com/Missel2/nodes7/pull/11), Windows/Linux `npm ci`, 9 green checks | MERGED to master f201bcc0 |
| N7-003 | P0 | COTP pending-handshake socket leak | [Issue #12](https://github.com/Missel2/nodes7/issues/12), [draft PR #13](https://github.com/Missel2/nodes7/pull/13), original red / candidate green Ubuntu+Windows | IN_PROGRESS; candidate patch requires CI, further cases and explicit merge approval |
| N7-004 | P1 | Disposable wire protocol CI | S7Comm connect, typed DB read, synthetic DB write/readback, restart, RST and blackhole on Ubuntu/Windows | TODO |
| N7-005 | P1 | ESLint/format checks and diagnostic type baseline | Protected quality gate plus independently observed negative control | TODO |
| N7-006 | P1 | Security/Dependency review | CodeQL evidence, release-vuln triage, safely updated dependencies | TODO |
| N7-007 | P2H | S7-1200 HIL bench | Named CPU/firmware/program/SHA, trusted-runner gating, safe procedure | PENDING_HARDWARE |
| N7-008 | P1 | Independent upstream fault/packet fixes | Reproducible own regression per candidate PR, no broad speculative merges | TODO |
| N7-009 | P1 | Define timezone-independent DT/DTL tests | Proven date read/write contract in multiple timezones without modifying meaning of values | TODO; legacy fixture assumes UTC-03 |

Cross-repo sources: [node-red-contrib-s7 Issue #2](https://github.com/Missel2/node-red-contrib-s7/issues/2), [PR #10](https://github.com/Missel2/node-red-contrib-s7/pull/10), [PR #13](https://github.com/Missel2/node-red-contrib-s7/pull/13). Issues are enabled. N7-002 is tracked as Issue #10. Create other issues only when the related work begins; do not duplicate.
