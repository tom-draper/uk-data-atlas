# Dataset compilers

`@uk-data-atlas/datasets` contains dataset definitions, source parsers, boundary
metadata and browser-safe transformations shared by the website and API.
It exports TypeScript source, with no package build step.

`compileDatasetContents(definition, reader)` compiles a definition using a
caller-supplied `DatasetReader`. The caller reads files and passes their
contents through that reader. The package does not import Node APIs or read
files. Callers own caches, worker pools, validation and output writing.

`pnpm data:build --only datasets` (`pipeline/src/compile-datasets.mts`) compiles every
definition once into `data/build/datasets/`, with the cache and worker pool in
`pipeline/src/precompile/`. The website precompile reads these intermediates to cut
regional chunks. The `atlas-sqlite` stage stores the catalogue payloads in
`data/build/atlas.sqlite` for both servers to read. See `data/build/README.md`.

The dataset worker pool uses currently available memory, reserves 1 GiB for the
parent process, and budgets 2 GiB per worker. Automatic concurrency is at least
one and at most four, and leaves one CPU available when possible.
`ATLAS_PRECOMPILE_JOBS` overrides this automatic sizing. A value of `1` compiles
on the main thread. A positive integer override bypasses the resource budget.

`pnpm data:build` reports the five slowest stages after a build completes or a
stage returns a failure status. Each entry separates command time from overhead,
including cache checks and recording. Cached stages have zero command time.
`--plan` does not report timings because it does not execute the commands.

Run `pnpm --filter @uk-data-atlas/datasets typecheck` for the package type check.
The root Vitest unit project includes package tests and checks that shared
packages only import declared dependencies.
