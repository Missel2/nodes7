# Next independent nodes7 alpha candidate — read-only qualification

**Status 2026-11-13: `0.1.0-alpha.2` source-only is merged into protected
master after PRs #34/#35 and their successful post-merge CI.
The package is still UNPUBLISHED, not installed into Node-RED and not
qualified on physical Siemens CPUs.** The new direct manual publication
procedure is [documented here](NPM_PUBLISH_GITHUB_ACTION.md) and is
proposed in a separate Draft PR. Merging the workflow alone publishes nothing. The immutable published
`@missel2/nodes7@0.1.0-alpha.1` remains separate. Historical first-alpha
setup in older references is not a request to redo its first-package
bootstrap or create a new `latest` placeholder.

## Candidate identity and isolated source provenance

- The source baseline is protected `master`
  [`2d0120c5fa9bb20c8be6fb9716958de2e7f15747`](https://github.com/Missel2/nodes7/commit/2d0120c5fa9bb20c8be6fb9716958de2e7f15747),
  after separately authorized PRs #34/#35. The proposed manual release
  workflow would create a further master commit when independently merged.
- Proposed exact package is `@missel2/nodes7@0.1.0-alpha.2`, public-scope
  metadata and **`alpha`** dist-tag only after a new conscious manual
  **public** release decision through the approved GitHub workflow. A package version in a Git branch
  is not a registry artifact. **Never** move `latest` implicitly.
- Manifest and root lockfile version must match exactly; every existing
  resolved dependency entry, tarball URL and integrity stays unchanged.
  Declared direct production dependency `iso-on-tcp@^0.1.0`, locked
  runtime `iso-on-tcp@0.1.0`, original author metadata and
  GPL-3.0-or-later must remain intact. Old transitive SHA-1 integrity and
  advisories are tracked separately; a green lock does not prove safety.
- The npm `files` allowlist is `src/`, plus npm's mandatory metadata,
  README and LICENSE. The tarball **must contain `src/s7address.js`**
  (S7ANY validation introduced in PR #33); executable CI scripts,
  raw test fixtures, lockfiles and workflow files must stay excluded.

## Required read-only checks on the exact future candidate SHA

1. **Published-version collision guard (GET only):** inspect the public npm
   registry for the precise `alpha.2` version. A 404 establishes only
   that this exact version is not currently publicly visible; it does
   **not** verify unpublished npm staged state, package ownership or
   registration rights. Any 200, timeout or unexpected status is a STOP.
2. **Clean install and source CI:** cross-platform Ubuntu 24.04/Windows
   2025, Node 22 unit regression and synthetic TCP/COTP/S7Comm tests;
   syntax Node 22/24; required status checks, CodeQL and active ruleset.
   Do not reuse checks from the baseline master as this candidate's CI.
3. **Real archive:** use `npm pack --ignore-scripts --json` without
   publication, strict name/version/tag and file allowlist checks,
   recorded archive SHA-1/SHA-256/SHA-512, matching tarball manifest and
   SPDX/CycloneDX *production-lockfile* SBOMs. Inspect actual GPL/license
   assets and origin credits. CI license metadata does not replace legal
   review or a private disclosure/history decision.
4. **Packed artifact consumer:** GitHub-hosted Windows/Linux Node 22
   independently install the **actual locally packed archive** into a
   disposable fresh npm project with scripts disabled, verify the installed
   version and exports, transitive runtime resolution and S7ANY invalid
   address fail-before-send behavior. This is a package-contract smoke,
   **not an installed Node-RED wrapper compatibility test** and not an
   independent public-npm-tarball test.
   The Git checkout must preserve canonical LF for every packed source file
   (`.gitattributes`), rather than allowing Windows `core.autocrlf` to
   rewrite source bytes. Both hosted jobs archive *checksum-only* file
   metadata, never the executable prerelease tarball. A dedicated
   `Packed archive reproducibility (Ubuntu/Windows, Node 22)` job must
   compare path, mode, content SHA-256, tarball SHA-256 and SHA-512 for
   **byte-for-byte identical output** before a source-merge decision.
   An earlier run before canonical LF normalization exposed a real
   cross-OS CRLF divergence despite successful installs; do not waive
   this gate.
5. **Risk and review:** read [candidate release notes](ALPHA2_RELEASE_NOTES.md),
   upstream/source credits, [protocol debt Issue #16](https://github.com/Missel2/nodes7/issues/16)
   and named HIL gaps. Verify a separate human source merge decision; then
   rerun post-merge CI on the actual protected `master` commit. No
   automatic staging follows a source merge.

## Distinct manual high-impact gates — NOT AUTHORIZED

| Gate | Current state |
| --- | --- |
| Source-only squash merges of PRs #34/#35 | **COMPLETE**, post-merge CI verified |
| Protected master SHA and post-merge CI | `2d0120c5fa9bb20c8be6fb9716958de2e7f15747`, 16/16 checks passed |
| Final archive and SBOM source SHA / digests | Gather only from exact CI candidate; must re-check after merge |
| npm account/scope owner, GPL/corresponding source and private disclosure review | Pending maintainer decision |
| Legacy npm staging path | **Superseded by direct-publication PR**; no stage performed |
| Direct public npm publish of alpha.2 | **NOT APPROVED OR EXECUTED**; a new explicit GitHub `publish` dispatch is mandatory |
| Contrib alias/lock update and its source merge | **NOT APPROVED**, wait for actually published library version |
| Contrib npm prerelease staging and publication | **NOT APPROVED**, independently controlled |
| Physical Siemens HIL | **PENDING_HARDWARE** |

Before public GitHub publication, reverify exact protected master, all
fresh green push checks, the fixed archive digest, the package identity
and absence of an existing public version. A human must explicitly select
`publish`; a PR merge alone is never release permission. Review any
preexisting privately staged alpha.2 candidate before starting.
After publishing, independently verify the public archive and provenance;
a failed job is not proof publication failed, so never blindly retry. Only after independently verifying a
downloaded public `alpha.2` archive should a new Contrib PR update
`@st-one-io/nodes7` npm alias and the **actual registry-derived**
SHA-512-locked `package-lock.json`; then run unmodified Node-RED installed
runtime on both OSes with synthetic classic S7Comm before separate merges
and possible Contrib release. Do not patch the upstream Node-RED host.
See [Contrib roadmap #21](https://github.com/Missel2/node-red-contrib-s7/issues/21)
and its [draft release-plan PR #52](https://github.com/Missel2/node-red-contrib-s7/pull/52).

**Rollback and risk:** an unpublished candidate can be closed or revised;
a published npm version is immutable in practical consumer workflows and
needs an independently approved successor/re-pin instead of silent
replacement. Firmware, CPU addressing, PUT/GET availability, optimized
DBs, long-run OT reliability and cross-PDU atomicity remain unverified.
No automatic write replay after ambiguous acknowledgments.
HIL-S7-001..007 all PENDING_HARDWARE. No real hardware, OT network,
registry write or production installation in this preparation.

Source review and preparation materially AI-assisted; maintainer owns
all merge, staging, publication and equipment decisions.
