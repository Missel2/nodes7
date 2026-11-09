# Origins, licenses and acknowledgements

**Direct fork:** [st-one-io/nodes7](https://github.com/st-one-io/nodes7), preserved original Git history, root `LICENSE` (GPL-3.0-or-later) and source copyright notices. Its package metadata names **Guilherme Francescon**; original project and contributors retain full attribution. This independent fork is not maintained or endorsed by upstream, Siemens or any automation vendor.

**Historical inspiration:** The upstream [README](https://github.com/st-one-io/nodes7#readme) identifies [plcpeople/nodeS7](https://github.com/plcpeople/nodeS7) as an inspiration for a rewrite. This is historical lineage, **not** a direct source/packaged dependency claim.

**Direct runtime dependency:** `iso-on-tcp`, declared by upstream `package.json`. After the N7-002 human-approved merge, the direct runtime `iso-on-tcp@0.1.0` and all 336 resolved package instances remain pinned without version change in a real v3 lockfile. This is NOT a security audit or an endorsement of old transitive packages; do not copy code from unrelated forks before an explicit license audit.

**Downstream integration:** [Missel2/node-red-contrib-s7](https://github.com/Missel2/node-red-contrib-s7) pins this fork at `2cf864e38be447c2709348a25eb0524d67f5cf2d` through its merged PR #15, using the inherited package key and a SHA-512-locked source archive. Further library merges do not automatically update that pin.

We thank ST-One, Guilherme Francescon, the nodes7/nodeS7 contributors and the Node-RED community. Credits do not imply association, endorsement or industrial certification. Preserve the GPL license, notices and source availability when distributing modifications. AI contributions are disclosed in each PR; final high-impact decisions belong to the human maintainer.


**Test-fixture reuse and provenance:** N7-003 PR #13 adapts disposable, AI-assisted classic-S7Comm loopback test sources from the same maintainer's [node-red-contrib-s7 PR #10](https://github.com/Missel2/node-red-contrib-s7/pull/10), replacing its external package import with the current fork's actual `src/index.js`. Tests use pinned `python-snap7==3.3.1` in hosted CI only, **not** as an added runtime npm package. The source and GPL notices stay intact, and neither maintainer nor libraries claim Siemens compatibility certification.
