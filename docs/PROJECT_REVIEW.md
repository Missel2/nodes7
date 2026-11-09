# Repository review — 2026-11-09

**Verified repository snapshot: 2026-11-09; baseline `2cf864e38be447c2709348a25eb0524d67f5cf2d`.** PR #13 is merged: pending COTP transport cancellation and software wire tests are on master. The wrapper pins this exact source archive through its merged PR #15. This is software evidence, not a published fork release or physical Siemens qualification.


## Scope and limits

This is an AI-assisted engineering review, not independent security certification
or proof that every execution path is correct. It inspected source structure and
selected lifecycle/queue/write/parser paths, manifests/locks, hosted workflows,
current issues/PRs/branches, protection rules and contributor documentation.
Historical evidence was compared with actual Git state. Hardware, a full Node-RED
runtime, long-duration load and every parser branch were not executed in this review.

## Findings and ownership

| Area | Observed evidence | Action / qualification gap |
| --- | --- | --- |
| Transport ownership | nodes7 #13 merged; wrapper pins `2cf864e38be447c2709348a25eb0524d67f5cf2d` | Preserve software regressions; long-run and packet-boundary work in nodes7 #16 |
| Rejected queue admission | `sendRaw` rejects after destroy but still appends work; reproduced locally | nodes7 #14 / PR #18; isolated one-line candidate, not merged |
| Wrapper lifecycle | 15 wrapper contracts + 4 deadline tests passed locally on Linux Node v24.22.1 | Full installed Node-RED/editor lifecycle still wrapper #18 |
| Writes | `writeVar` forwards promise results; success roundtrip exists | Unknown acknowledgement, admission bounds and completion contracts in wrapper #19; no duplicate-write defect asserted |
| Encoding and dates | Parser/item suites and fixed UTC-03 fixture convention exist | Independent boundary vectors in nodes7 #16; explicit DT/DTL contract in #17 |
| Supply chain | Both locks are v3; nodes7 retains old dev tooling; existing Dependabot PRs #2–#9 | nodes7 #15, existing wrapper PR #11; no sweeping update |
| CI/protection | Active `protect-master`; nodes7 8 required contexts, wrapper 6; protected aggregate gates wire/static matrices | Wrapper CodeQL is observed successful but not named as a required context in the inspected ruleset; align enforcement in #7 |
| Distribution | Inherited upstream package names/versions; wrapper pins a source archive | Distinct release identity and actual tarball install in shared #21; no publication |
| Community entry | Contradictory unmerged status, missing contributor entry, duplicate wrapper PR templates | This documentation PR refreshes entry points, quickstart and template |
| Hardware | No named CPU/firmware results | Shared #8; all HIL cases pending |

## Exact baseline checks

GitHub check-run snapshots at the baseline SHAs were inspected through the public
API. nodes7 had 12 successful Verification/CodeQL jobs plus three successful
Dependabot checks; wrapper had 18 successful jobs, including CodeQL analyses,
Windows/Linux wire/lock/static checks and advisory types. Advisory type success
means diagnostics were captured, not that types are error-free. No pending new PR
head inherits these results. Protection settings were read, not modified.

## Dependency audit snapshot

`npm audit --json` on nodes7's unchanged v3 lock, npm 11.9.0, 2026-11-09:
37 affected package entries (5 critical, 23 high, 6 moderate, 3 low). This count
includes transitive/metavulnerability propagation and is not 37 independent exploits.
`npm audit --omit=dev --json` reported zero known production findings. Neither result
proves absence of vulnerabilities; reachability and advisory disposition remain #15.
No `npm audit fix`, lock rewrite or dependency upgrade was performed.

## Priority and acceptance

The [shared roadmap](https://github.com/Missel2/node-red-contrib-s7/issues/21) is the canonical ordered checklist. Release work
must attach an evidence manifest tying **both** source SHAs to package digests,
lock hashes, precise test environments, known advisory decisions and hardware state.
An expiring Actions artifact is not permanent proof; retain a concise verified
summary and hashes with release evidence. Avoid new dashboards duplicating this index.
