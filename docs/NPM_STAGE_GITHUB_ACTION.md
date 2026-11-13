# Controlled npm staging using a manually dispatched GitHub Action

**Status: proposed on a separate PR, not merged and not executed.**
The user approved staging `@missel2/nodes7@0.1.0-alpha.2`, NOT public npm
publication. The protected master source at design time was
`c8b6e9e9dc48e240166527cb2e08410eebad5cf7`.
After any approved source-PR merge the actual `master` SHA changes:
never reuse an older SHA in a workflow dispatch.

## GitHub/npm account setup (manual owner step)

1. Create GitHub **Environment** `npm-stage` in `Missel2/nodes7`.
   Add required reviewer(s) to prevent an unattended stage if your GitHub
   plan and team configuration permit them. The workflow itself has a
   manual start and an independent verify/stage selector.
2. On npmjs.com open **`@missel2/nodes7` → Settings → Trusted publishing**.
   Add a new **GitHub Actions** trusted publisher with these exact values:

   | Property | Value |
   | --- | --- |
   | Organization/user | `Missel2` |
   | Repository | `nodes7` |
   | Workflow filename | `npm-stage-manual.yml` |
   | GitHub environment | `npm-stage` |
   | Allowed actions | **Only `npm stage publish`** |
   | Direct `npm publish` | **DISALLOWED** |
   | `npm dist-tag` | **DISALLOWED** |

   A new publisher may have a first-use expiry window; configure it
   shortly before the authorized staging run.
3. Trusted publishing uses OIDC on a **GitHub-hosted Ubuntu** runner,
   with `id-token: write` in the stage job only. No npm token is stored.
   No preflight/test job can acquire OIDC write credentials. The separate
   GitHub environment approval should be enabled on the environment itself.

## Run workflow

Go to **GitHub → Actions → npm stage only (manual) → Run workflow**,
select branch **master** and choose:

- `operation=verify` (the default): a completely read-only check;
  runs exact protected source validation, all 16 named green push-CI checks
  and all three successful push workflows on that SHA; checks npm public
  version absence, archive content, locked dependencies, license, SPDX and
  CycloneDX. No npm writes.
- `operation=stage`: after successful verification, a second job is
  eligible to run. When the GitHub environment reviewer has approved (if
  configured), it repeats the exact SHA/master and package gates,
  builds an identical tarball and calls **only**
  `npm stage publish <verified-tarball> --tag=alpha`.
- `source_sha`: exact **current protected master commit** in 40 hex chars.
  It must equal checkout SHA and live GitHub API master commit. A new merge
  changes it, and existing authorizations must be reassessed.
- `archive_sha256`: exact audited canonical SHA-256:
  `11327c208ad99dae5eca2fd4a6fd9a83e17637b8eb4ad1f2018c6ba98bd6c81e`.
  Its value is fixed by both the workflow guard and the manually supplied
  input; any mismatch aborts before the upload.

The workflow has **no** push, pull_request or scheduled trigger, cannot
automatically merge, does not change dist-tags, and archives only JSON
review metadata. Archive bytes are validated *before* staging. The
source and digest checks are repeated immediately before the stage job.

## Stage read-back and explicit separate approval

The OIDC trusted publisher can run **`npm stage publish` only**.
It **cannot** use `npm stage list/view/approve/reject` because npm
requires interactive login for those. Therefore npm-authenticated
maintainers must inspect the **Staged Packages** tab on npmjs.com before
and after a stage, retrieve its stage ID, verify name/version/tag, SHA-1
and SHA-512 and inspect the staged tarball. GitHub cannot assert the
absence of an already privately staged version through read-only public
registry checks. A stage may have succeeded even if CI loses its final
network response: NEVER blindly rerun without inspecting the stage
queue first.

Publishing is a separate explicit human decision using 2FA
(`npm stage approve <stage-id>` or npmjs.com); **this workflow does
not and cannot approve or directly publish**.

No Contrib dependency/lock updates, Node-RED changes, GH releases or
tags, production deployment, OT traffic or physical PLC/HIL access.
HIL-S7-001..007 remain PENDING_HARDWARE.

Official npm references:
- https://docs.npmjs.com/trusted-publishers/
- https://docs.npmjs.com/staged-publishing/

AI-assisted workflow; maintainer controls npm account settings, GitHub
environment, source-PR merge, stage decision and eventual 2FA approval.
