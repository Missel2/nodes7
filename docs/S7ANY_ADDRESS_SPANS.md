# S7ANY 24-bit address-span admission (N7-032)

**Status: candidate on draft PR #33; no merge or npm release.** This document
records tested software semantics, not industrial controller qualification.

## Wire limit and address units

Classic S7ANY encodes the start as a 24-bit **bit position**
(`0x000000` to `0xffffff`).

- Public byte-oriented `readArea/readDB/readInputs/readOutputs/readFlags`
  accepts nonnegative safe integer byte offsets, including nonempty numeric
  strings. The last encodable starting byte is `0x1fffff` (2,097,151).
  A read that would cross this limit is rejected **before any PDU dispatch**;
  a zero-length operation still validates its starting address.
- Generic `readVars/writeVars` **BYTE** items use a byte offset and a
  byte length; their *whole* span must fit. **BIT** items instead use a
  raw bit offset and bit length; the last legal bit is `0xffffff`.
  BIT addresses are not multiplied by eight.
- For generic non-BYTE/non-BIT transport codes (e.g. special timer/counter
  transport), the start is checked against the 24-bit byte-derived limit,
  but its transport-specific `length` is deliberately **not** reinterpreted
  as an ordinary BYTE span. Additional transport-length semantics require
  separate evidence; this change does not certify them.
- `S7ItemGroup` validates the full byte footprint of all items before
  read packet construction or write packet dispatch. That avoids sending
  an early valid packet when a later requested tag is out of range.
  Its BIT write address is calculated by multiplication rather than the
  JavaScript 32-bit left shift. No S7ItemGroup write is atomic after dispatch.

The 24-bit address limit describes **protocol encodability only**. It is not
a promise that a given Siemens CPU has that address space or any PUT/GET
permissions. Invalid requests reject with `ERR_INVALID_ARGUMENT`.

## Regression and scope

- Immutable test-only baseline `ce93d9affbf8bd33c55e00a988c4acff8cfd7291`
  reproduces **10 intentional failures / 288 passing** on both hosted
  Ubuntu 24.04 and Windows 2025 (Node 22).
- The exact same corrected tests pass against candidate source. A separate
  mutation temporarily widens the S7ANY limit *only in a throwaway copy*
  and must fail the public `readDB()` overflow assertion for the expected
  reason.
- A disposable `python-snap7==3.3.1` localhost COTP/S7Comm test checks
  invalid public read/generic batch calls while connected and verifies a
  subsequent successful readback. Zero invalid job submissions are
  independently asserted at the synthetic connection boundary.
- No physical Siemens controller, optimized DB support, plant safety or
  industrial fitness is implied. HIL-S7-002/003/006: PENDING_HARDWARE.
  No replay of ambiguous writes or default polling behavior change.

See [Issue #32](https://github.com/Missel2/nodes7/issues/32),
[PR #33](https://github.com/Missel2/nodes7/pull/33),
[protocol qualification #16](https://github.com/Missel2/nodes7/issues/16),
and the downstream [release roadmap](https://github.com/Missel2/node-red-contrib-s7/issues/21).
