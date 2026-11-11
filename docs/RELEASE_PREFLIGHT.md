# Independent nodes7 alpha release candidate

**Candidate only; not published, staged, tagged or installed in a production system.**

- Proposed registry package: `@missel2/nodes7@0.1.0-alpha.1` with public visibility and npm dist-tag `alpha`. Scope ownership must be confirmed by the maintainer before staging.
- Original source: [st-one-io/nodes7](https://github.com/st-one-io/nodes7). The independent fork retains original author metadata, license and history. GPL-3.0-or-later applies; do not imply upstream or Siemens endorsement.
- Protected candidate baseline: `39f3b9d5f41c34c73ff713c3b708f4a7e4673248`. The published bytes, when eventually approved, must come from a separately reviewed final commit and match the approved SBOM/artifact hashes.
- Runtime API: `require('@missel2/nodes7')` retains the same exported S7 classes as the original package. The package **name** changes; import sites are not automatically rewritten.
- Production dependency remains `iso-on-tcp@^0.1.0`, current tested locked version `0.1.0`. Its range may resolve differently for consumers; the downstream wrapper must test clean npm installations and compare real installed versions. No sweeping dependency bump in this release candidate.
- The tarball contains `src/` and npm-mandatory `README.md`, `LICENSE` and `package.json` only. Tests, CI, workflows, old tooling, lockfile, generated reports and operational data are excluded.

## Read-only qualification

The [release-preflight workflow](../.github/workflows/release-preflight.yml) runs on hosted Ubuntu, with `contents: read` only; no npm tokens, OIDC, physical OT runner or publish/stage commands. It checks:

1. Strict package scope/version, `alpha` tag, production runtime dependency identity, root lockfile/manifest agreement, and negative controls for altered scope/tag/dependencies.
2. Actual `npm pack --ignore-scripts` archive compared with npm's file manifest; expected runtime files, allowlist and npm SHA-1 / SHA-512 integrity checked against archived bytes plus separately calculated SHA-256.
3. Production dependency SBOM from committed lockfile, both SPDX and CycloneDX, including the single runtime dependency. License metadata and the existing dependency license file are asserted; this is **not** legal analysis.
4. Source commit, manifest, lock, SBOM and archive hashes in a non-identifying JSON evidence manifest. Only the JSON evidence is uploaded to GitHub for short retention; the executable tarball is not archived.
5. Standard source/API contracts, cross-platform locked install, real synthetic S7Comm loopback, deterministic COTP/fault tests and CodeQL remain independently required by the protected CI.

No physical Siemens S7 test is performed. **HIL: not applicable to package identity/CI metadata**; all hardware tests remain PENDING_HARDWARE.

## Human release decisions — still not authorized

1. Review actual archives and file metadata, license notices/corresponding-source commitments, advisories, software compatibility, and any historical public disclosure issues. CI cannot establish industrial suitability.
2. Obtain explicit separate approval for the candidate PR merge; review that protected master and its post-merge CI are green. Review `@missel2/nodes7` scope and ownership in npm.
3. Obtain explicit separate approval before any **first npm staging**, even though the staged alpha bytes are held: new packages create a publicly visible placeholder version `0.0.0-stage`.
4. npm 11.15+ and Node 22.14+ support `npm stage publish`; the eventual real version becomes public **only after the maintainer approves the stage using 2FA**. Bootstrap the first package identity without an always-valid publishing token where possible.
5. Once the package identity exists, separately configure a **stage-only** GitHub Actions trusted publisher with OIDC. A new publisher must be exercised within npm's expiry window. A future manually dispatched publish workflow needs explicit review and human authorization; none exists in this PR. No permission for direct `npm publish` or `npm dist-tag` changes is implied.
6. After `@missel2/nodes7@0.1.0-alpha.1` has actually been published, migrate the downstream `node-red-contrib-s7` dependency. To preserve its existing `require('@st-one-io/nodes7')` statements initially, the prospective npm alias is `"@st-one-io/nodes7": "npm:@missel2/nodes7@0.1.0-alpha.1"`. This is a **future plan**, not a currently installable dependency. Rebuild the wrapper lockfile, test on Node-RED and synthetic S7Comm across Windows/Linux, and request its own merge/release approval.
7. Never claim that a passed unit/CI suite is a physical Siemens CPU test, safety certification, or deployment approval.

Official references: [npm staged publishing](https://docs.npmjs.com/staged-publishing/), [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).
