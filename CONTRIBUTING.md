# Contributing

Thanks for helping improve the UK Data Atlas. Issues and pull requests are
welcome.

[ARCHITECTURE.md](./ARCHITECTURE.md) explains how the repository is laid out,
where its data lives and which way its code may depend. Read it before moving
code between the atlas, the API and the shared packages.

## Licensing of contributions

The UK Data Atlas source code is released under the
[AGPL-3.0](./LICENSE) and is also offered under a separate commercial licence.
To keep that possible, every contribution needs the agreement below before it
can be merged.

### Contributor licence agreement

By submitting a contribution (code, documentation or data-processing scripts)
to this repository, you agree that:

1. You wrote the contribution, or otherwise have the right to submit it under
   these terms.
2. You keep the copyright in your contribution.
3. You grant Tom Draper, the project maintainer, a perpetual, worldwide,
   non-exclusive, royalty-free, irrevocable licence to use, copy, modify,
   distribute and sublicense your contribution, and to release it under the
   AGPL-3.0, a commercial licence, or any other licence.
4. You grant everyone who receives the project a licence to your contribution
   under the AGPL-3.0.
5. If your contribution includes third-party material, you have identified it
   and its licence in the pull request.

To agree, include this line in your pull request description:

> I have read and agree to the contributor licence agreement in
> CONTRIBUTING.md.

## Data

Datasets and boundary files keep the licence of their source. A pull request
that adds or changes a source must record its publisher, source URL and licence
as described in [DATA-LICENCES.md](./DATA-LICENCES.md).

## Data build output

Every data build stage prints through `buildLog` and its formatters in
`packages/atlas-db/src/buildTiming.ts`. A test fails if a stage
calls `console.log`, `console.info` or `console.warn` directly.

- Write status lines in sentence case with no trailing full stop, and results
  in the past tense with repo-relative paths, such as
  `Wrote 322 rows to data/build/x.json`. Use no emoji, bracket tags or padded
  `label : value` columns.
- Use `formatDuration` (`<0.1s`, `4.2s`, `42s`, `3m 07s`, `1h 02m`),
  `formatBytes` (`512 B`, `4.2 KB`, `7.2 MB`, `1.13 GB`, or `7.2 MB gzip` with
  `formatGzipBytes`) and `formatCount` (`1,234,567`).
- `buildLog.info` prints a status line. `buildLog.warn` and `buildLog.error`
  print `Warning: ...` and `Error: ...` to stderr. `buildLog.artifact` takes a
  kind, a name and `{ status, bytes, ms }`, and prints
  `dataset: house-price.json (compiled, 7.2 MB, 5.9s)`.
- Print one summary line for a stage, not one line per file. Per-file lines go
  to `buildLog.detail`, which prints only with `pnpm data:build --verbose`.

`pnpm data:build` prints a line as each stage starts and finishes and indents
the stage's own output by two spaces:

```text
Data build: 44 stages, 12 to run, 32 unchanged

sources: unchanged, skipped
datasets: running (2 of 12)
  dataset: house-price.json (compiled, 7.2 MB, 5.9s)
  Compiled 322 datasets into data/build/datasets in 1m 07s
datasets: done in 1m 07s

Data build done in 1h 02m (12 ran, 32 unchanged)
Slowest stages:
  boundary-tiles  41m 10s
  datasets        1m 07s
```

The number to run is an estimate from the cache. A stage that reruns and
leaves its outputs unchanged lets the stages after it be skipped, so the build
can run fewer. `--plan` and `--verbose` also print each stage's command and
dependencies, and `--verbose` adds the command and overhead split to the
slowest stages.
