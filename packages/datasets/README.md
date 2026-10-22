# Dataset compilers

`@uk-data-atlas/datasets` contains dataset definitions, source parsers, boundary
metadata and browser-safe transformations shared by the website and API.
It exports TypeScript source, with no package build step.

`compileDatasetContents(definition, reader)` compiles a definition using a
caller-supplied `DatasetReader`. The caller reads files and passes their
contents through that reader. The package does not import Node APIs or read
files. Callers own caches, worker pools, validation and output writing.

The website orchestrates compilation in `scripts/precompile/`. The API invokes
`scripts/build-api-datasets.mts` through `pnpm --dir services/api build:datasets`.
Both use the file adapters under `scripts/precompile/sources/`.

Run `pnpm --filter @uk-data-atlas/datasets typecheck` for the package type check.
The root Vitest unit project includes package tests and checks that shared
packages only import declared dependencies.
