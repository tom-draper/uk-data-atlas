# Dataset compilers

`@uk-data-atlas/datasets` contains dataset definitions, source parsers, boundary
metadata and browser-safe transformations shared by the website and API.
It exports TypeScript source, with no package build step.

`compileDatasetContents(definition, reader)` compiles a definition using a
caller-supplied `DatasetReader`. The caller reads files and passes their
contents through that reader. The package does not import Node APIs or read
files. Callers own caches, worker pools, validation and output writing.

`pnpm data:build --only datasets` (`scripts/compile-datasets.mts`) compiles every
definition once into `compiled/datasets/`, with the cache and worker pool in
`scripts/precompile/`. The website precompile reads these intermediates to cut
regional chunks. The `atlas-sqlite` stage stores the catalogue payloads in
`compiled/atlas.sqlite` for both servers to read. See `compiled/README.md`.

Run `pnpm --filter @uk-data-atlas/datasets typecheck` for the package type check.
The root Vitest unit project includes package tests and checks that shared
packages only import declared dependencies.
