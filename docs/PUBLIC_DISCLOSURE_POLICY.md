# Public repository disclosure boundary

**Policy, not proof of historical sanitation.** This independent S7Comm library is developed in public. Repository content and artifacts must remain vendor-neutral and must not expose the private infrastructure or operational records of any adopter, maintainer, employer or customer.

## Allowed in public

Generic classic-S7Comm behavior, source code, synthetic loopback fixtures, reproducible fault tests, upstream citations, exact-source CI evidence, and manually reviewed non-identifying compatibility summaries. Use `127.0.0.1`, `example.invalid`, or reserved documentation ranges (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`) for examples. Do not derive public fixtures from real controllers.

## Keep strictly private

- Site, organization, customer, department, installation, production-line, machine, asset and operator identifiers, including identifying combinations of otherwise innocuous facts.
- Industrial network topology, controller IPs and hostnames, routes, zones, access controls, firewalls, private registries, internal CI/build hosts, credentials and certificate data.
- Controller projects, tags, registers, process values, unredacted packet captures and diagnostics, operational timestamps, plant schedules, incident reports, proprietary configurations and private image/build metadata.
- Site-specific indicators, deny-lists, scanner input, test logs and failure descriptions that reproduce the confidential material. **Never put private forbidden words or hashes of secret indicators into a public CI configuration.**

Private operational evidence belongs in an independently access-controlled system; no public PR runner or public dependency analysis job may access real industrial hardware.

## Contributor and release process

1. **Before the first public push**, inspect the exact staged diff, paths and filenames, commit and branch names, generated outputs, fixtures and comments using an authorized private procedure and private rule set. Do not paste private scan results into GitHub.
2. Public CI may check generic high-confidence hazards, but runs only **after** a push and cannot prevent disclosure. Never print captured secret strings in an error message or CI artifact.
3. Before issue/PR/release publication, inspect text, metadata, files, archives and package tarballs for private evidence. Use synthetic local test cases by default.
4. If physical controller testing is authorized, keep complete CPU/firmware, operator, network, capture and image details private. Publish only a vetted and non-identifying summary, without equating a simulator run to physical qualification or treating a read test as a write test.
5. If an exposure is found, stop further sharing and assess it privately. Removing a file from the current branch does not remove earlier Git commits, forks, CI logs, releases or external caches. History rewrite/takedown is a separate risk-assessed action; exposed credentials must be handled immediately.

AI-generated contributions and human-authored changes follow identical disclosure rules. Maintainers retain explicit approval authority for merges, releases, deployments and physical tests.
