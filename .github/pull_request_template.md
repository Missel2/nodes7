## Scope and baseline

- Upstream/base commit:
- Related issue or work-index item:
- Files and intended behavioral change:
- What is explicitly out of scope:

## Test-first evidence

- Failing original baseline / negative control:
- Passing proposed change / test command:
- Platform, runtime, exact head SHA and CI run links:
- Real S7Comm loopback tests (if applicable):
- Limitations, flaky/blocked tests or known failures:

## Behavioral state-transition acceptance (mandatory for relevant changes)

- Public command vs externally caused state, tested configuration and expected/forbidden transitions:
- Same-endpoint end-to-end scenario (explicit stop → explicit resume → external loss → conditional automatic recovery), or technical reason N/A:
- Original-red / same-test candidate-green and meaningful negative control (or reason N/A):
- Public events, network requests, fresh reads, socket/timer state **before fixture cleanup**, bounded wait and JSON evidence:
- `autoReconnect=0` and enabled, cancellation, delayed callback and no ambiguous write replay (applicable cases or justified exceptions):
- Exact-head Windows/Linux checks and remaining HIL obligations:

## HIL applicability

- HIL-S7-* IDs or `HIL: not applicable` with justification:
- Physical S7-1200 test executed: **No**, unless a named authorized execution and evidence are linked.
- No PLC writes or production network interaction in public PR CI.

## Security / credits / compatibility

- API/behavior compatibility and downstream Node-RED impact:
- Dependencies, integrity, license and attribution changes:
- Sensitive data redacted and no network to real PLCs:

## Review, rollback and AI disclosure

- Risks and worst plausible impact:
- Safe rollback:
- AI-assisted work performed (implementation/tests/review):
- Maintainer approval needed for merge. **No auto-merge, npm publish, production deployment or unattended HIL**.
