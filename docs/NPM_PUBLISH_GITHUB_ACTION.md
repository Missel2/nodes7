# Manual one-step npm alpha publication via GitHub Actions

**Status 2026-11-15:** workflow source merged in approved PR #36; the first
public publish attempt failed BEFORE npm upload because a relative archive
path lacked the leading `./`. Draft fix PR #37 adds this explicit local
specifier and real CLI dry-run checks; this source change does not publish
any package. The npm/OIDC registry handshake is not yet qualified. The maintainer asked to **reduce routine clicks**: one manual
GitHub Actions dispatch can now verify the exact archive and publish it
directly, with *no additional npm stage approval*. This makes a completed
`publish` workflow a **real public release**, not a preview.

## Prerequisites (one-time account setup)

- Protected source repository: `Missel2/nodes7` public `master`.
  The PR introducing this workflow **must be separately squash-merged
  with human approval**, followed by a fresh green master push CI.
- GitHub repository Settings → Environments: create `npm-release`,
  restrict permitted deployments to branch `master`. A *required
  reviewer* is an optional additional safety step, **but requires another
  manual approval click**. For the requested single-dispatch workflow,
  omit Required reviewers. The GitHub dispatch on master is the deliberate
  human release action. Disabling self-review restrictions or bypasses
  is a separate security decision, not something this PR does.
- npmjs.com → `@missel2/nodes7` → Settings → Trusted Publishers →
  GitHub Actions: configure **user `Missel2`, repository `nodes7`,
  workflow filename `npm-publish-manual.yml`, environment `npm-release`,
  Allow `npm publish` enabled, Allow `npm dist-tag` disabled**.
  The workflow uses only short-lived GitHub OIDC; do not provide a
  long-lived npm token, automation secret, npm OTP or password.
  Trusted Publisher permissions are controlled by npm, not by the PR.
  If an older stage-only publisher for
  `npm-stage-manual.yml`/`npm-stage` exists, remove it when the new
  publisher is operational (or leave it disabled). The old workflow is
  removed on this PR so the two release paths cannot be confused.
- Before the **first public release**, check any existing nonpublic
  `alpha.2` staged candidate under npmjs.com Staged Packages.
  The public registry GET cannot detect a private stage. If one exists,
  review and reject/reconcile it rather than starting an ambiguous
  direct publish. Only npm maintainers can do this interactively.

## One-click release workflow

Go to repository **Actions → npm publish alpha (manual) → Run workflow**,
choose `master` and the operation:

| Operation | What it does |
| --- | --- |
| `verify` (default) | All checks and archive verification, **no npm write** |
| `publish` | Repeats all checks, then **publishes `@missel2/nodes7@0.1.0-alpha.2` publicly** with npm Trusted Publishing OIDC and dist-tag `alpha` |

**No SHA or archive digest typing**: GitHub itself provides the exact
`github.sha`. The workflow checks that it still equals the live protected
`master` commit, that its **16 original required source/package checks**
and all three post-merge push workflows (Verification, CodeQL, read-only
release preflight) passed on that exact commit, and that the runtime
production dependency and package identity were not modified.

The archive has fixed canonical SHA-256
`11327c208ad99dae5eca2fd4a6fd9a83e17637b8eb4ad1f2018c6ba98bd6c81e`.
Both Linux/Windows source archive equivalence and real archived
consumers were already qualified in independent source CI. This action
rebuilds and verifies the archive from protected master *twice* and
publishes **that exact tarball** rather than a fresh rebuild.
It checks archive identity, embedded `src/s7address.js`, npm SHA-512,
license/SPDX/CycloneDX, and public npm version absence. The second
publish job is the only job with `id-token:write`. There is **no**
`push`, `pull_request`, tag or scheduled trigger and **no**
stage/approve/publish on merge.

Publishing command (after all gates):
`npm publish <verified-package.tgz> --tag=alpha --access=public --provenance`.

## First public-release attempt: diagnostic and regression (2026-11-15)

[Run #43749926977](https://github.com/Missel2/nodes7/actions/runs/43749926977) succeeded at every source/CI/archive/
checksum guard and pinned npm 11.15.0 installation, then failed in the
final publish CLI invocation (exit 128). npm mistakenly tried to resolve
`ssh://git@github.com/publish-evidence/missel2-nodes7-0.1.0-alpha.2.tgz.git`
because the relative tarball argument had no explicit `./` prefix.
Nothing reached the npm publication endpoint in that attempt.

The corrected invocation uses:

```bash
npm publish ./publish-evidence/missel2-nodes7-0.1.0-alpha.2.tgz --tag=alpha --access=public --provenance --ignore-scripts --registry=https://registry.npmjs.org/
```

CI now deliberately verifies this exact command is present and rejects the
bare relative shorthand; it also runs an actual `npm publish ./... --dry-run`
against locally built audited tarballs without registry writes in the PR
preflight and manual verify/publish jobs. A dry-run validates tarball spec
handling but does **not** test the npm OIDC authorization handshake.

Do not rerun failed workflow #43749926977: it is pinned to the old code.
After explicit squash-merge authorization for the separate fix PR and
successful master push CI, start a **new** manually chosen `publish`
workflow only after confirming the public version is still absent.

Reference: https://docs.npmjs.com/cli/v12/commands/npm-publish/

## After successful publishing

1. Inspect the public
   `https://www.npmjs.com/package/@missel2/nodes7/v/0.1.0-alpha.2`
   and independent registry metadata: version `0.1.0-alpha.2`,
   dist-tag `alpha`, published `dist.integrity` and archive content.
   Provenance should reference `Missel2/nodes7`.
2. A **failed job is not proof that the package was not published**:
   the registry could commit a publish before a dropped connection.
   Check the public version first; never blindly re-run `publish`.
3. A public npm version is effectively immutable. Revert through a
   *new reviewed version*, not by overwriting alpha.2.
4. **No automatic Contrib update**: only after independently verifying
   published npm tarball identity should a separate Contrib PR update
   the npm alias and registry-derived SHA-512 lock, with separate
   unit/integration/Node-RED gates.
5. OT/PLC HIL-S7-001..007 still PENDING_HARDWARE, no production
   deployment or real Siemens CPU activity. Alpha.2 changes may write
   more of an explicitly requested multi-PDU buffer than alpha.1;
   do not equate publication with plant validation.

## Documentation

- https://docs.npmjs.com/trusted-publishers/
- https://docs.npmjs.com/generating-provenance-statements/
- [nodes7 preflight](RELEASE_PREFLIGHT.md)
- [alpha.2 behavior and risks](ALPHA2_RELEASE_NOTES.md)

AI-assisted, human-reviewed source change. The separate GitHub
`publish` dispatch constitutes a **new affirmative maintainer release
decision**. This PR authorizes no publication by itself.
