# Development handoff — independent nodes7 fork

## Verified basis (2026-11-08)
- CI/governance [PR #1](https://github.com/Missel2/nodes7/pull/1) human-approved and squash-merged `1cbacddd05cac82f5a70e14469bf21b901df6de1`.
- Reproducible lockfile [N7-002 PR #11](https://github.com/Missel2/nodes7/pull/11) separately human-approved and squash-merged `f201bcc0acdad4742e4066fa084577f23e396ce1`. Full 336-package lock preserved all resolved versions, npm ci Ubuntu/Windows green, 9/9 checks; 57 legacy SHA-1 SRI entries remain future security debt. Protected `master`, eight required contexts, no bypass, no auto-merge.
- No Siemens hardware tests and no production protocol implementation patch so far.

## Active task N7-003

Issue [#12](https://github.com/Missel2/nodes7/issues/12), development branch `test/n7-003-cotp-pending-transport-red-20261108`. Start by confirming actual direct-package failing TCP regression on this commit under Ubuntu/Windows. Two tests create disposable loopback TCP peers that actually receive a 22-byte RFC1006 COTP CR but deliberately withhold confirmation: early public disconnect and native ~10-second watchdog. Tests record peer/client socket state **before forced fixture cleanup** and explicitly fail correct cleanup assertions on original code. The temporary workflow considers only both named assertion failures a **successful diagnosis**; it does not assert the defect is fixed. Run and inspect actual CI logs/artifacts before citing success.

Next: preserve first exact-head Windows/Linux original-red proof, then develop a **minimal real `src/s7endpoint.js` fix** in a follow-on commit on this PR or a separate PR, while retaining immutable original source test as the red counterexample and identical repaired source as green. Add late-handshake and RST scenarios and repeated cycles; preserve real S7Comm read/write and restart. Keep HIL-S7-001/-005 `PENDING_HARDWARE`.

**No direct push to `master`, no additional merge without human approval, no npm publication, production OT deployment, real PLC access or plant writes.** Test evidence is not a Siemens firmware/PLC compatibility claim.
