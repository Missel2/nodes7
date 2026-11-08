# Development handoff — nodes7 fork

**Initial baseline:** `Missel2/nodes7/master` SHA `ec89d6b8c7b71fbc83c308c44bbcb6d078998201`, matching upstream. Package source is `@st-one-io/nodes7@1.1.2`. No own protocol runtime patch in CI/bootstrap.

**This work:** PR branch `chore/bootstrap-ci-governance-20261108`, governance and initial hosted CI. Check open PR, exact head and actual Actions results before claiming success. The lockfile is inherited/stale and is deliberately untouched. This PR is not a test of physical Siemens equipment.

**Bootstrap finding:** The first CI run found four inherited DT/DTL timezone-dependent assertions (237 passing/four failing in both OSes with TZ=UTC). The CI harness now sets and explicitly verifies the historical fixture's UTC-03 timezone. This does not fix timezone-independent production semantics; N7-009 is separate. Validate the new exact head before deciding on a merge.

**Next priority order:** (1) get bootstrap workflow passing; (2) enable Issues and active protect-master ruleset once check contexts exist; (3) human-approved merge; (4) separate lockfile repair with real integrity fields and `npm ci` on both platforms; (5) import/independently verify the actual COTP blackhole/early-disconnect tests from [Node-RED wrapper #10](https://github.com/Missel2/node-red-contrib-s7/pull/10) and [#13](https://github.com/Missel2/node-red-contrib-s7/pull/13); (6) patch resource ownership in this library with baseline-red/candidate-green and protocol roundtrip intact; (7) separately integrate pinned nodes7 fork into Node-RED wrapper.

**Safety:** No direct push to master, automatic merge, npm publish, OT deployment, or real PLC contact; HIL-S7-* remain PENDING_HARDWARE. Consult `docs/WORK_INDEX.md` and update evidence rather than repeating stale status statements.
