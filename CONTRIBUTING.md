# Contributing

Thank you for helping maintain this independent fork. Original ST-One authorship,
source history and GPL-3.0-or-later notices remain intact. Read [AGENTS.md](AGENTS.md)
and the [work index](docs/WORK_INDEX.md) before starting. We welcome small fixes,
reproducible reports, documentation improvements and test contributions.

## Choose the responsible layer

| Symptom | Starting point |
| --- | --- |
| COTP/S7 framing, address encoding, transport teardown or library queue | [nodes7](https://github.com/Missel2/nodes7/issues) |
| Node-RED configuration, messages, status, redeploy or editor | [node-red-contrib-s7](https://github.com/Missel2/node-red-contrib-s7/issues) |
| Unsure | Open one report and describe the installed source pin; maintainers can route it |

Search existing issues/PRs first. The [shared roadmap](https://github.com/Missel2/node-red-contrib-s7/issues/21) lists available
work and dependencies. A library PR and the wrapper's dependency update are separate reviews.

## Hardware-free development

The current hosted checks use Node 22/24 for selected jobs. These are tested job
versions, not a promise that every older runtime or Node-RED release is supported.
Use an isolated development directory; installing the upstream npm package name
will not install this fork.

```sh
git clone https://github.com/Missel2/nodes7.git
cd nodes7
npm ci --ignore-scripts --no-audit --no-fund
node scripts/ci/check-syntax.cjs
node --test test/bootstrap/api.contract.test.cjs
```

The inherited unit date fixtures need `TZ=America/Sao_Paulo`. On a POSIX shell run
`TZ=America/Sao_Paulo npm test`; on Windows CMD run `set TZ=America/Sao_Paulo`
followed by `npm test`. This workaround is tracked in issue #17.

Wire tests need Python 3.12 and the pinned `python-snap7==3.3.1` fixture; reproduce
the relevant commands from `.github/workflows/verification.yml`. Use synthetic
loopback data only. Do not supply a real PLC address to CI or public examples.

## Report a bug

Include repository/source SHA (both wrapper and library where relevant), Node/OS,
Node-RED version, minimal synthetic flow or test, expected/actual behavior, exact
command and bounded redacted logs. State whether evidence is mock, loopback wire,
vendor simulation or authorized hardware. Do not attach plant traces, PLC projects,
credentials or proprietary programs. Suspected vulnerabilities need private disclosure,
not a public exploit report; coordinate privately with the maintainer if a reporting
channel is not enabled.

## Submit a change

1. Create a branch; keep one coherent defect or documentation task per PR.
2. For a fix, run the same regression red on the named baseline and green on the candidate.
3. Preserve public behavior and original notices; document intentional compatibility changes.
4. Include exact commands, commit/CI links, failed or unrun checks, risk and rollback.
5. Disclose material AI assistance and declare HIL case IDs or a concrete not-applicable reason.

A passing synthetic test does not establish CPU/firmware support. Human maintainers
make merge, release and hardware decisions. No response-time guarantee is implied.
