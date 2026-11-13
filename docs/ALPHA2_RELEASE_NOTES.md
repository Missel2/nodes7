# Proposed release notes: @missel2/nodes7 0.1.0-alpha.2

**UNRELEASED CANDIDATE, not a public npm artifact.** Changes below are
present in protected source `master` as of
[`1c24ed354da03748013b69bb415186aed43f034d`](https://github.com/Missel2/nodes7/commit/1c24ed354da03748013b69bb415186aed43f034d)
and are to be packaged in [Draft PR #34](https://github.com/Missel2/nodes7/pull/34)
subject to complete CI, separate merge and npm staging/publication
authorizations. The previously published `0.1.0-alpha.1` is immutable
and does not automatically include these changes.

## Candidate changes since the first-alpha source cut

| Source merge | Behavior and boundary |
| --- | --- |
| [#24](https://github.com/Missel2/nodes7/pull/24) / `777694c0` | Adds **opt-in `maxQueuedJobs`** waiting-queue admission on S7Connection, `ERR_QUEUE_FULL` before dispatch for a refused PDU. Omitted option retains historical unbounded waiting queue. A multi-PDU write remains non-atomic. |
| [#28](https://github.com/Missel2/nodes7/pull/28) / `b11d7868` | Normalizes `readArea()` byte addresses before PDU offsets; accepts nonempty numeric strings, rejects malformed base values. |
| [#30](https://github.com/Missel2/nodes7/pull/30) / `6cac29dd` | Preserves UserData protocol `returnCode` in error handling for diagnosis. |
| [#26](https://github.com/Missel2/nodes7/pull/26) / `a523d9dd` | Adds **opt-in `abortOnTimeout`**: closes a timed-out session and interrupts remaining outstanding work; cannot roll back a write already applied at the peer. |
| [#31](https://github.com/Missel2/nodes7/pull/31) / `b4a0a5dd` | Corrects multi-PDU `writeArea()` chunk slicing and string-offset address computation. A complete requested buffer can now be written where earlier source silently omitted bytes. Guards the full direct write byte span against 24-bit S7ANY overflow. |
| [#33](https://github.com/Missel2/nodes7/pull/33) / `1c24ed35` | Rejects overflowed complete `readArea()` spans and generic BYTE/BIT `readVars/writeVars` items before dispatch, avoids 32-bit `<< 3` address alias, and validates grouped item spans before sending any PDU. Preserves valid BIT-unit and numeric-string address behavior. |

## Compatibility and operational hazards

- **Formerly truncated writes can now reach all requested addresses** when
  the PLC permits them. Existing automation must not assume the former
  omitted bytes or depend on a silent partial write. Verify address
  allowlists, DB layout, buffer lengths and writes in an authorized
  isolated lab **before any production adoption**.
- **Fail-closed input validation:** out-of-24-bit-bit-address spans or
  unsafe JavaScript numeric offsets now reject with
  `ERR_INVALID_ARGUMENT`; previously an over-large offset could alias
  another memory location. A valid S7ANY wire range does not imply the
  target PLC actually implements that address.
- **Multi-PDU writes remain non-atomic.** Timeout, disconnect, explicit
  PDU failure or lost ACK cannot prove that none/some/all remote bytes
  were applied. No implicit replay of ambiguous writes. An opt-in
  queue limit rejects **individual unsent PDUs** only; earlier PDUs
  from the same high-level operation may have executed.
- **Special TIMER/COUNTER and other non-BYTE/non-BIT transports** have
  qualified start-address bounds only; full transport-specific length
  semantics remain unverified.
- The legacy default waiting queue is still unbounded unless
  `maxQueuedJobs` is expressly configured. `abortOnTimeout` defaults
  to false. The Node-RED wrapper's independently opt-in
  `boundedWrites` does not automatically activate either option.
- Inherited DT/DTL unit fixtures still use `TZ=America/Sao_Paulo`;
  timezone independence is tracked separately in the N7-009 workstream
  and must not be advertised as solved.
- Remaining [protocol fault and parser qualification #16](https://github.com/Missel2/nodes7/issues/16),
  [dependency/security debt](https://github.com/Missel2/nodes7/issues/15),
  and **all physical HIL-S7-001..007** remain open/pending.

## Validation and downstream release boundary

- Source controls: actual Ubuntu/Windows Node 22 legacy and S7Comm
  suites, Node 22/24 syntax, CodeQL, negative fault/oversize
  controls. Relevant same-test original-red/candidate-green evidence
  predates this release-only metadata PR.
- Archive controls: exactly `src/` and npm mandatory metadata/README/
  LICENSE, with `src/s7address.js` included; actual packed tarball
  installed in disposable clean Windows/Linux Node 22 consumers. A
  canonical-LF `.gitattributes` policy and a **separate cross-OS
  identical-archive SHA-256/SHA-512 check** prevent a Windows CRLF
  checkout from accidentally yielding different prerelease bytes.
- The exact candidate SHA, tarball SHA-256/SHA-512, SBOM digest and
  public npm registry absence must be attached to the **final PR head**
  and rechecked after any approved merge. No CI run alone authorizes
  npm stage, public approval, or `alpha`/`latest` changes.
- The published `@missel2/node-red-contrib-s7@0.1.0-alpha.1`
  continues to pin the older published nodes7 `alpha.1` through
  the `@st-one-io/nodes7` npm alias. A new Contrib source/lock PR,
  installed unmodified Node-RED 5.0.9 tests and a distinct later
  Contrib release gate are required **only after nodes7 alpha.2
  actually exists in the npm registry**.

**No Siemens CPU/firmware, real plant network, deployment, write safety
certification, npm staging or publication performed by this candidate.**
HIL-S7-001..007 remain `PENDING_HARDWARE`.
