# Optional S7Connection waiting-queue admission (N7-008/011)

**Status: human-approved [PR #24](https://github.com/Missel2/nodes7/pull/24) merged into protected master as `777694c0789e3eae9020b59dfe401a93244cd2b8`; still absent from published `alpha.1`. A separate `alpha.2` source candidate does not imply publication.** This is an opt-in *per-S7Connection* request admission contract. Current published `@missel2/nodes7@0.1.0-alpha.1` and the independently published Node-RED wrapper **do not inherit this change**. Physical HIL-S7-003/004/005/006 is PENDING_HARDWARE.

## Why `maxJobs` is not enough

`maxJobs` limits **parallel in-process PDUs** after S7Comm setup. It does not bound `_jobQueue`, which can grow while all negotiated slots are occupied or while connection setup is in progress. The previous library offered no independent queue-capacity refusal.

## Optional configuration

```js
// Use a disposable synthetic transport fixture, not a real PLC.
const S7Connection = require('./src/s7connection');
const conn = new S7Connection(disposableDuplex, {
    maxJobs: 1,
    maxQueuedJobs: 2,
    timeout: 2000
});
```

When using an `S7Endpoint`, the existing `s7ConnOpts` option forwards the option to the underlying `S7Connection`. **This does not automatically opt in Node-RED S7 flows**, nor does it change the wrapper's separate `boundedWrites` behavior.

- **Omitted:** historical unbounded waiting queue; existing applications retain the same default behavior. This is a compatibility choice, *not* a recommendation to leave industrial consumers unbounded.
- **Nonnegative safe integer:** maximum number of **waiting** requests, excluding in-flight PDUs and the S7Comm setup telegram; `0` allows dispatch into a free negotiated slot but **no waiting**. Negative/fractional/string/null/nonfinite values raise `ERR_INVALID_ARGUMENT` during construction.
- **At capacity:** if the request cannot immediately dispatch, it rejects with `NodeS7Error.code = "ERR_QUEUE_FULL"`. `error.info` includes `sent:false`, `queued`, `maxQueuedJobs` and `inFlight` at the moment of refusal. **That specific refused PDU is never assigned a PDU reference, enqueued or sent.** There is no automatic retry.
- **FIFO:** accepted work preserves existing FIFO and normal S7 protocol response/timeout/disconnect behavior. A queued request's subsequent transport failure or timeout **does not prove** that its action was not executed.
- **Not a transaction guarantee:** `S7ItemGroup.writeItems()` can split one logical write into multiple PDUs and launch them concurrently. Some PDUs can already be in-flight or acknowledged when a later PDU is refused. `ERR_QUEUE_FULL` guarantees only **the refused PDU** was not sent. The group-level write may have partially taken effect. The application must handle that possibility conservatively and must **never blindly replay an ambiguous write**.

This limit neither bounds the number of higher-level callers outside `S7Connection` nor applies process-wide across endpoints. It does not replace service-level admission, backpressure observability, request deadlines or a field-level safety assessment. In the default configuration, the library still permits unlimited pending work. A separate future design decision is needed for changes to legacy defaults.

## Evidence and limitations

The [same queue regression suite](../test/s7/s7connection.queue.spec.js) was first run on protected baseline `1c6d223cebce9d8b448965c5ecea97435b66bbb0` before this source patch: 243 prior tests passed; **five new cases failed** as intended (`ERR_QUEUE_FULL` missing and invalid option accepted), including one against a real disposable localhost TCP/S7Comm peer. The unchanged-default case passed. [Baseline red job](https://github.com/Missel2/nodes7/actions/runs/43090675056) was observed directly. Candidate-green results must be collected on the **final exact PR head**; this document is not a pass declaration.

Negative control: substitute a broken condition that admits one request beyond capacity; the same-test assertion must fail, without relying on a harness timeout or fixture cleanup to create the failure. Test evidence captures queued/in-flight sizes, serialized frames and pre-cleanup socket frame counts. No Siemens hardware was used. Real recovery/timeout/partial-multiwrite scenarios remain separate acceptance debt in [Issue #16](https://github.com/Missel2/nodes7/issues/16).
