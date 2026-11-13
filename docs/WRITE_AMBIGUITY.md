# Multi-PDU S7 writes: interruption and partial outcomes

**Engineering contract, not an industrial qualification.** This describes the
behavior exercised by [nodes7 PR #31](https://github.com/Missel2/nodes7/pull/31)
for the pre-existing `S7Endpoint.writeArea()` data-integrity defect. The
underlying `S7Connection` opt-in timeout abort was merged separately in
[PR #26](https://github.com/Missel2/nodes7/pull/26). Hardware cases
HIL-S7-003 and HIL-S7-006 remain **PENDING_HARDWARE**.

## Guarantees and non-guarantees

- `writeArea()`, `writeDB()`, `writeFlags()` and `writeOutputs()` split
  buffers larger than the negotiated PDU payload into multiple WRITE_VAR jobs.
  After the PR #31 correction, each job uses the intended byte slice and numeric
  byte offset. The existing API dispatches jobs concurrently and waits for
  their responses using `Promise.all`.
- **Resolved success** means each awaited WRITE_VAR result reported
  `DATA_OK`. It does **not** make multiple PDUs an atomic transaction.
  Reads/writes by other actors, PLC logic and controller-specific behavior
  are outside this guarantee.
- **Rejected / timed-out / disconnected** means the *overall call did not
  complete successfully*. It does **not** establish that no memory was
  written, nor that the last submitted PDU was rolled back. Other concurrent
  writes might already have succeeded or may still be in flight when an
  early rejection reaches the caller.
- `abortOnTimeout: true` in `S7Connection` is strictly opt-in, configured
  via `s7ConnOpts` for `S7Endpoint`. It interrupts remaining requests and
  closes the session on an in-flight timeout, but cannot undo a write already
  applied by the peer. An ordinary transport drop has its own cleanup path.
  Reconnection must **never** imply reissuing an ambiguous write.
- `ERR_INTERRUPTED` and `ERR_TIMEOUT` indicate interruption and expiry;
  an explicit WRITE_VAR return code indicates only the outcome reported for
  that PDU. There is currently **no public per-PDU durable acknowledgement
  ledger**; callers cannot reliably derive a byte-level committed range
  from an overall error.

## Deterministic test scenarios

At a negotiated PDU size of 240 bytes, a 600-byte write beginning at
synthetic byte offset 100 is partitioned into 212, 212 and 176 bytes.

| Injected event | Acknowledged to caller | Known applied in the fixture | What the caller can conclude |
| --- | --- | --- | --- |
| ACK PDU 1, abort PDU 2 before apply; PDU 3 never dispatched | 212 bytes | 212 bytes | Overall failure; PDU 2 could not be confirmed from the application result alone |
| ACK PDU 1, apply PDU 2 but drop its ACK; PDU 3 never dispatched | 212 bytes | 424 bytes | Same overall failure; even 424 applied bytes cannot be inferred from missing ACK |
| PDU 1 success, PDU 2 explicit NACK, PDU 3 success | PDU 1 and 3 success in controlled fixture | 388 noncontiguous bytes | Whole call rejects; subsequent concurrent jobs are not automatically rolled back |

The first two scenarios use the real `S7Endpoint` and `S7Connection` over a
disposable **localhost TCP stream with encoded S7Comm PDUs**. They use a
custom transport and **do not test COTP framing**; a separate
python-snap7 loopback suite covers actual ISO-on-TCP/COTP and normal
WRITE_VAR readback. The third scenario uses a deterministic in-memory
WRITE_VAR responder to force response statuses. All fixture byte counts
are privileged *test-observed facts*, not information available to a
production caller after a connection is lost.

The tests assert the overall rejection, original byte contents and
addresses, third-PDU non-dispatch in the drop cases, TCP peer closure,
no unintended write replay on reconnection and a precise
`ERR_INTERRUPTED` error in the controlled drop. The legacy truncation
bug is independently reintroduced in an isolated mutation test, which
must fail the unmodified exact-byte regression. These are software
regression tests, **not real Siemens PLC or firmware evidence**.

## Safe operator and maintainer response

1. Treat a failed multi-PDU write as **potentially partially applied**, not
   as zero bytes written. Do not automatically retry the entire buffer.
2. Isolate the operation and determine whether the target memory is safe to
   inspect. In an **authorized isolated test environment**, use independent
   readback and application-specific reconciliation before considering any
   subsequent action; do not assume readback is stable under concurrent
   PLC/user activity.
3. Record request ID, intended ranges, per-request evidence if available,
   error type and session state, without publishing actual process values,
   network addresses or private runtime logs.
4. Require a separate, risk-assessed human operation for any follow-up
   physical write. PLC output and plant behavior may have side effects
   that cannot be undone by restoring a DB byte value.

This document does not authorize npm publishing, deployment or physical
read/write testing. The human maintainer must separately approve both any
future merge and industrial validation. Source/test work was AI-assisted,
using synthetic publicly safe fixtures only.
