# GitHub repository settings — human actions and verification

**Observed 2026-11-08:** `Missel2/nodes7` is public, default `master`, fork at `ec89d6b8`. GitHub repository metadata reported `has_issues: false`; `/rulesets` returned none. The original fork had no workflows. Workflow files alone do not establish security scanning or branch protection.

After first successful PR runs (not before check names exist):

1. **Enable Issues** in Settings > General > Features. Then turn `docs/WORK_INDEX.md` items into a small linked set of GitHub issues as appropriate.
2. Settings > Rules > Rulesets > New branch ruleset: name `protect-master`, enforcement **Active**, target default branch `master`. Require a pull request, require resolved conversations, disallow branch deletion and force pushes, and require branch up-to-date before merge.
3. Select the *actual* status contexts from CI:
   - `Syntax and negative control (ubuntu-24.04, Node 22)`
   - `Syntax and negative control (ubuntu-24.04, Node 24)`
   - `Syntax and negative control (windows-2025, Node 22)`
   - `Syntax and negative control (windows-2025, Node 24)`
   - `Upstream unit baseline (ubuntu-24.04, Node 22)`
   - `Upstream unit baseline (windows-2025, Node 22)`
   - `Package baseline (Ubuntu, Node 22)`
   - `Analyze (javascript-typescript)` **only after CodeQL is confirmed operational**.
4. Single-maintainer rule: do **not** require an approving GitHub review if only the author account can review; written explicit human approval in chat remains required. Do not auto-merge or add a publish/deploy workflow.
5. Confirm repository Settings > Security & analysis for CodeQL, secret scanning, Dependabot alerts and private vulnerability reporting. Workflow source does not enable every security feature. GitHub Actions itself was enabled by the owner.

No connector permission for repository settings administration is assumed. These actions require the repository owner's UI and verification of the effective ruleset. Do not claim protection exists until GitHub confirms it.

## Verified active settings after PR #1 (2026-11-08)

- GitHub Issues are enabled.
- Ruleset [protect-master #26809728](https://github.com/Missel2/nodes7/rules/26809728) is **active** for default `master`, 0 bypasses, no force pushes/deletions, PR-only merges, required conversation resolution, 0 formal second approvals and strict up-to-date status checks.
- Eight GitHub Actions check contexts are required: four syntax, two inherited unit, one aggregate package baseline, and `Analyze (javascript-typescript)`. CodeQL and PR #1 were green on verified exact heads. No auto-merge.
- The Security & Analysis UI switches (Dependabot alerts/security updates, private reporting, secret scanning, push protection) are **not accessible through the GitHub connector**, so their enabled status has **not been verified** through an authoritative API. Do not assert these are on solely based on the presence of `SECURITY.md` or `codeql.yml`.
- N7-002 draft PR #11 makes `npm ci` and lockfile negative controls transitively required through existing status-check names. No additional ruleset context is necessary for this PR.
