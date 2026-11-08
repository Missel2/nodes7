# Work index (usable while Issues are disabled)

| ID | Priority | Work | Exit evidence | State at fork/bootstrap |
| --- | --- | --- | --- | --- |
| N7-001 | P0 | CI/governance bootstrap | PR, exact head CI, no runtime changes | IN_PROGRESS |
| N7-002 | P0 | Rebuild inherited stale npm lockfile | Real lockfile v3, integrity, Ubuntu/Windows `npm ci`, immutable dependency set | TODO |
| N7-003 | P0 | COTP pending-handshake socket leak | Failing original + passing fix on identical network tests, no forced peer teardown | TODO, defect reproduced in sibling repo |
| N7-004 | P1 | Disposable wire protocol CI | S7Comm connect, typed DB read, synthetic DB write/readback, restart, RST and blackhole on Ubuntu/Windows | TODO |
| N7-005 | P1 | ESLint/format checks and diagnostic type baseline | Protected quality gate plus independently observed negative control | TODO |
| N7-006 | P1 | Security/Dependency review | CodeQL evidence, release-vuln triage, safely updated dependencies | TODO |
| N7-007 | P2H | S7-1200 HIL bench | Named CPU/firmware/program/SHA, trusted-runner gating, safe procedure | PENDING_HARDWARE |
| N7-008 | P1 | Independent upstream fault/packet fixes | Reproducible own regression per candidate PR, no broad speculative merges | TODO |
| N7-009 | P1 | Define timezone-independent DT/DTL tests | Proven date read/write contract in multiple timezones without modifying meaning of values | TODO; legacy fixture assumes UTC-03 |

Cross-repo sources: [node-red-contrib-s7 Issue #2](https://github.com/Missel2/node-red-contrib-s7/issues/2), [PR #10](https://github.com/Missel2/node-red-contrib-s7/pull/10), [PR #13](https://github.com/Missel2/node-red-contrib-s7/pull/13). Create actual issues when the fork's Issues setting is enabled; do not create duplicate or overlapping work.
