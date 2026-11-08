# Quality policy: contracts, negative controls and operational boundaries

**Document type: policy, not proof of implementation.** Applies to this independent classic-S7Comm protocol fork.

1. **Reproduce before fixing.** For a reliability defect, write a deterministic failing baseline test on the exact old revision; make the same assertion pass on the corrected revision. A green expected-red diagnostic proves only reproduction.
2. **No silent regression.** Keep the existing public exports, connection events, address formats, parsing, PDU framing, read/write results and retry semantics unless an explicitly versioned and reviewed change is necessary. No automatic replay of a write whose previous outcome is ambiguous.
3. **No abandoned resources.** Disconnect, timeouts, COTP partial handshake, late peer responses and reconnect must not leave application-managed sockets, timers, stale callbacks or unbounded retry loops. Collect evidence before the test fixture destroys sockets.
4. **Separate assurance levels.** A parser unit test is not S7Comm wire coverage; a Snap7 server is not a Siemens firmware/CPU; HIL tests and production deployment are separate gates.
5. **Traceable evidence.** Each PR states head SHA, exact commands, Ubuntu/Windows runtime, run URLs, fault injected, expected/observed outputs, artifact location and unsolved risks. Never report a skipped, timed-out harness, or suppressed exception as success.
6. **Safe data handling.** Logs are bounded, actionable and free of plant addresses, data values and credentials. Tests may write only disposable loopback fixtures; physical PLC writes require a separate approved lab procedure.
7. **Supply chain.** Existing GPL-3.0-or-later notices stay intact; new dependencies and imported patches need licensing and integrity review. Windows and Linux hosted `npm ci` became a mandatory protected CI gate in the explicitly human-approved N7-002 squash merge `f201bcc0`. The verified 336 package-version instances remain unchanged; 57 legacy SHA-1 integrities and security-debt triage are independent of reproducibility.
8. **Release safeguards.** No automatic merge, package publication, production deployment or untrusted public-PR execution on PLC-reachable runners.

Priorities: connection teardown first; deterministic protocol/fault CI second; robustness, diagnostics and tested compatibility afterward.
