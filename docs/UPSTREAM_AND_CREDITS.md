# Origins, licenses and acknowledgements

**Direct fork:** [st-one-io/nodes7](https://github.com/st-one-io/nodes7), preserved original Git history, root `LICENSE` (GPL-3.0-or-later) and source copyright notices. Its package metadata names **Guilherme Francescon**; original project and contributors retain full attribution. This independent fork is not maintained or endorsed by upstream, Siemens or any automation vendor.

**Historical inspiration:** The upstream [README](https://github.com/st-one-io/nodes7#readme) identifies [plcpeople/nodeS7](https://github.com/plcpeople/nodeS7) as an inspiration for a rewrite. This is historical lineage, **not** a direct source/packaged dependency claim.

**Direct runtime dependency:** `iso-on-tcp`, declared by upstream `package.json`. Any license and resolved-version claim for the final dependency tree must await the lockfile/reproducibility review; do not copy code from unrelated forks before an explicit license audit.

**Downstream integration:** [Missel2/node-red-contrib-s7](https://github.com/Missel2/node-red-contrib-s7) currently installs `@st-one-io/nodes7@1.1.2`. This fork does **not** automatically replace the npm dependency merely because GitHub fork exists.

We thank ST-One, Guilherme Francescon, the nodes7/nodeS7 contributors and the Node-RED community. Credits do not imply association, endorsement or industrial certification. Preserve the GPL license, notices and source availability when distributing modifications. AI contributions are disclosed in each PR; final high-impact decisions belong to the human maintainer.
