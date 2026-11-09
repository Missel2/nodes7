# Security policy — independent development fork

This repository is an independently maintained fork of [st-one-io/nodes7](https://github.com/st-one-io/nodes7), not a Siemens product or a certified industrial communications component. The inherited `1.1.2` metadata is **not** a fork-specific supported release, and no response SLA or supported production versions are promised.

Please use GitHub private vulnerability reporting for this repository **if the feature is enabled**. If it is not enabled, contact the maintainer through their GitHub profile to coordinate a private channel before sharing a vulnerability description. Do not put exploitable details, credentials, real PLC addresses, plant topology, raw process traces or unsafe write instructions into public issues.

Changes require reproducible tests and explicit maintainer review. No public CI job is allowed to reach a real PLC. Security and quality check success is not Siemens compatibility, safety certification, or authorization to deploy to OT systems. Upstream and dependencies retain their own separate maintenance responsibility.

Dependencies, security alerts and lockfile integrity must be triaged. The v3 lockfile and hosted `npm ci` were established by merged PR #11. Reproducibility does not resolve inherited development-tool advisories; issue #15 tracks exposure and remediation. See `docs/WORK_INDEX.md`.
