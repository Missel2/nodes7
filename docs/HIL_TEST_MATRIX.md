# Pending hardware-in-the-loop test debt (not executed)

**Status:** `PENDING_HARDWARE` for every case. There is no approved hardware runner or authorized physical Siemens CPU test for this fork.

| ID | Physical test goal | Prerequisites | State |
| --- | --- | --- | --- |
| HIL-S7-001 | Basic S7-1200 PUT/GET connect/disconnect and rejection | Named isolated CPU, read-only | PENDING_HARDWARE |
| HIL-S7-002 | BOOL/BYTE/INT/REAL synthetic DB read/byte layout | Versioned nonoptimized scratch DB | PENDING_HARDWARE |
| HIL-S7-003 | Exact allowlisted scratch DB write/readback/reset | Separate human write permission | PENDING_HARDWARE |
| HIL-S7-004 | Pending read: reconnect/stale read never published | Controlled harmless network fault | PENDING_HARDWARE |
| HIL-S7-005 | Repeated setup failure/reconnect, bounded sessions and cleanup | Rate-limited loopback/lab fault proxy | PENDING_HARDWARE |
| HIL-S7-006 | Ambiguous write acknowledgment: no duplicate action | Separate write + fault permission | PENDING_HARDWARE |
| HIL-S7-007 | Redeploy, shutdown, disconnect cleanup | Isolated runtime | PENDING_HARDWARE |

Each relevant PR declares IDs and documents lack of hardware runs. Evidence must name CPU order number, firmware, TIA test-program hash, exact Git commit, approved operator, test case, before/after state, date and logs. The PLC must have no machinery or physical output effects. TCP/102 reachable only from an isolated, trusted and manually approved runner; never from public PR jobs. Do not treat simulator success as hardware evidence or enable unreviewed live writes.
