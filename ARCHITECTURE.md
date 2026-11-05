# Architecture

How the repository is laid out, where its data lives, and which way its code
may depend. What the API is for, and what to build next, is in
[services/api/DIRECTION.md](services/api/DIRECTION.md).

## Two products, one geography engine

The repository holds two products:

- **The atlas**, the Next.js website at the root. It is the priority, and it
  runs on the VPS under systemd, behind Nginx.
- **The API**, a Node service in `services/api`. It runs on the same VPS, and
  that server also builds its data. See [deploy/README.md](deploy/README.md).

Both answer geography questions. The API resolves relationships and compiles
place profiles, the docs catalogue, and containment and lineage lookups.
The website fetches these over HTTP and shares browser-safe code through
`packages/`. It never imports API project code.

## Layout

```
/                       the atlas (Next.js): app/, components/, lib/
packages/geography/     shared geography code: lineage, containment file
                        formats, geometry substitutions, grid offsets
packages/catalogue/     shared catalogue code: the register of corrections
packages/datasets/      browser-safe dataset definitions and compilers
packages/atlas-runtime/ server-only atlas data and API modules
packages/artifacts/     artifact storage, hashing and file formats
packages/map-tiles/     the boundary tiler: shared-arc generalisation and
                        PMTiles archives, for the API and the website data build
services/api/           the API: src/, scripts/, config/, openapi.yaml
services/mcp/           the MCP server: a read-only HTTP client of the public API
scripts/                build orchestration and file readers for both products
data/
  source/               raw source files, restored from the data release
  build/                shared generated datasets, atlas.sqlite and website-assets.sqlite
public/data/            the atlas's compiled data, served by the website
```

## Where the data lives

| Where                   | What                                                           | In git      | Made by                                                                                            |
| ----------------------- | -------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| `data/source/`          | Raw files as publishers supplied them                          | No          | `pnpm data:download`, from the release pinned in `data-release.json`                               |
| `data/build/`           | Shared generated datasets, `atlas.sqlite`, `website-assets.sqlite` | README only | `pnpm data:build`                                                                                  |
| `data/build/artifacts/` | Remaining generated API catalogues and downloads               | No          | `pnpm data:build`                                                                                  |
| `public/data/`          | The atlas's compiled datasets, boundary properties and PMTiles | No          | `pnpm data:build`, `pnpm data:build --only boundaries` and `pnpm data:build --only boundary-tiles` |

Raw release archives keep their paths relative to the source root. The existing
pinned release restores into `data/source/` without republishing. For an existing
checkout, move its raw folders and `.source-release.json` from `data/` into
`data/source/`, leaving `data/build/` in place.

`map-figures.json`, `ranking-pages.json` and `rankings/*.json` hold map
headlines and ranked areas, compiled by `scripts/build-seo-data.mts` from the datasets. The website owns that
step: `pnpm dev` and `pnpm build` run it, and `data:build` does not.
Rankings read the precomputed `ward-areas` page from SQLite.

The data build compiles website artifacts with `pnpm data:build --only atlas-pages`.
That stage reads only the areas, crosswalks, geometry, named locations and
catalogue manifests it uses, not the API's release manifest. It stores gzipped files and a manifest under
`data/build/atlas-assets/atlas-pages/` and `atlas-pages.json`. The API serves them at
`/v1/atlas-pages/{page-id}.json`. `pnpm data:build --only website-lookups` stores their
precompressed bytes in `data/build/website-assets.sqlite`, a file the API does not read. The website reads them directly
for server rendering and serves browser requests at `/data/atlas-pages/{page-id}.json`:

| Page id               | Contents                                                   |
| --------------------- | ---------------------------------------------------------- |
| `places-index`        | Every place and the boundary release lists                 |
| `places-area-{shard}` | Area profiles, sharded by code                             |
| `places-named-{id}`   | A named place profile                                      |
| `place-facts`         | Median age and ethnicity by code                           |
| `ward-areas`          | Ward areas used by ranking recipes                         |
| `docs-catalogue`      | Datasets, measures, exports and boundary releases for docs |

The website server reads these from disk, once per server instance.
Current councils, constituencies and named places prerender during the website
build; wards render on first visit. Place search fetches the index from the
website on focus. A missing copy fails rendering rather than returning a false
missing place.

The API builds from raw `data/` without `public/data/`. The shared `datasets`
stage compiles every catalogue dataset once into `data/build/datasets/` (see
[data/build/README.md](data/build/README.md)). The `atlas-sqlite` stage stores their
metadata and statistics rows in `data/build/atlas.sqlite`. The payload the
website reads for each dataset is generated from those rows, checked against
the compiled dataset by value, and cached in `data/build/atlas-cache.sqlite`.
The API catalogue
compiler and atlas pages read it directly through the server-only reader in
`packages/atlas-runtime/src/storage/atlasSqlite.ts`. The `api-datasets` stage only builds
gazetteer core and boundary assets under `data/build/artifacts/source-data/`.
Named locations consume that gazetteer. The Next.js server also reads SQLite
and passes dataset URLs containing their payload SHA-256 to the browser. Its
`/data/catalogue/<sha256>/<output>.json` route serves exact JSON with one-year
immutable caching and negotiated gzip compression. Neither product fetches
catalogue datasets from the other product.

The Next.js server also answers measure queries at `/data/measures/<measure>`.
It runs the shared `queryMeasureValues` (`packages/atlas-runtime/src/catalogue/measureValues.ts`),
the function the API's series selection and aggregation rules also use, over the
same statistics rows, and returns columns of values per area and period with the
measure's value kind, unit and dimensions. It reads `data-catalog.json`,
`statistics-read-path.json`, `statistics-vocabulary.json` and the reviewed
`services/api/config/measure-dimensions.json` next to `atlas.sqlite`, so a
website deployment ships those with the database. See
[docs/website-measure-queries.md](docs/website-measure-queries.md).

The website data build reads `data/build/datasets/` when cutting regional chunks,
without copying the catalogue payloads. `public/data/datasets/` retains
gazetteer, road-safety, chunk and SEO assets and the website build manifest.

The atlas's containment and lineage lookups (`area-lineage`,
`boundary-mappings`, `parish-lad-mappings`, `lsoa-lad-mappings-{year}` and
`constituency-lad-overlaps`) are not in the repository. The data build
compiles them with `@uk-data-atlas/geography` for the boundary releases
`@uk-data-atlas/catalogue` lists. The API serves them at
`/v1/atlas-lookups/{id}.json`. The website never reads them from the API.
The `pipeline/` workspace runs `pnpm data:build --only website-lookups` to import them
from `data/build/atlas-assets/` into the shared database. Page and lookup compiler
entry points still live in API scripts until their shared readers are extracted. The browser fetches them at
`/data/atlas-lookups/{id}.json`, and the precompiler reads the same database rows
when cutting regional chunks. The import also stores place profiles, facts, ward
areas and the docs catalogue. It validates source hashes before replacing rows
in one transaction, leaves unchanged imports untouched, and removes old public
copies after success. The final API release manifest hashes the database after
this import. Building needs the shared release on disk. Next.js builds and servers
read the database without running the importer or needing a running API. The API
serves page and lookup gzip files from `data/build/atlas-assets/`.

Everything in `data/build/artifacts` is build output, so its layout on disk is
the API's own business. Clients reach every file through a route, and a route
can find its file anywhere. What freezes when v1 leaves early access is the routes, their
parameters and what they return.

## Which way code may depend

```text
pipeline/ ──────────┐
website ────────────┼──► packages/*
services/api ───────┘
```

- The pipeline imports shared code and declared dependencies. It cannot import
  API project code, root scripts or the website's `lib/`. Neither product's
  runtime imports the pipeline. `tests/packages/packageImports.test.ts` checks
  these boundaries. Existing root and API data builders will move in later PRs;
  see [the inventory and move order](docs/data-pipeline-move.md).
- `services/mcp` is a client of the public API. It reaches the API over HTTP
  only and imports no repository code, so it never joins the diagram above.
  `tests/packages/packageImports.test.ts` checks this.
- The website reads `services/api/openapi.yaml` for its API reference. Pages
  and lookups come from the shared release, without reading API build output.
- Other generated API files remain under `data/build/artifacts/` for now. They
  sit beside `atlas.sqlite` so the pipeline writes only under `data/build/`, and
  `packages/atlas-runtime/src/storage/dataLayout.ts` resolves their locations
  from the repository root. The API directory remains the home of its config
  and `openapi.yaml`.
- Browser-safe packages keep Node imports out of their browser entry points.
  `packages/atlas-runtime`, `packages/artifacts` and `packages/shapefile` are
  Node packages and may read files. Package boundary tests check that imports
  stay within each package or its declared dependencies.

Import a package by name (`@uk-data-atlas/geography`), never by a relative
path. Packages ship TypeScript source: Turbopack and `tsx` both compile it, so
there is no build step.

Pipeline unit tests and shared pipeline test fixtures live under
`pipeline/tests/`. API tests may import pipeline code only through the fixture
modules explicitly listed in `tests/packages/packageImports.test.ts`. The
pipeline and API suites also use Vitest; `pnpm check` runs each unbuilt suite
once. Pipeline tests that require built data live in `pipeline/tests/built/` and
run through `pnpm check:full`.

## One data build

`pipeline/build-data-graph.mjs` lists every data build stage for both
products, with its dependencies. `pnpm data:build` builds all API and website
data in dependency order, including SQLite and PMTiles. Product targets
are no longer supported. Stages run from the repository root.
Stages that read an intermediate SQLite component pass its database path to
the shared readers directly, without constructing a temporary API directory.

`--plan` lists the stages without running them. `--only <stage>` builds one
stage and its prerequisites, reusing cached results where valid. `--from <stage>` rebuilds
a stage and its downstream consumers using existing upstream outputs.
These two options cannot be combined. For example:

```sh
pnpm data:build --only website-tiles
pnpm data:build --only atlas-sqlite --plan
pnpm data:build --from datasets
```

Independent stages run in parallel. A stage starts once its dependencies have
finished, with at most `--jobs <n>` running (default `DATA_BUILD_JOBS`, else the
CPU count) and their memory within a budget (`DATA_BUILD_MEMORY_MB`, else the
free memory, capped at three quarters of the total). A stage costs its
`--max-old-space-size` value, or 1 GB without one. `--jobs 1` runs one stage at
a time in plan order. With several jobs, each output line is prefixed with
`[stage]`, and `--plan` ends with the waves of stages that can run together and
the critical path.

Each graph stage lists the paths it changes in `stageWrites` (in
`pipeline/build-data-graph.mjs`), beyond its `outputs` and `requiredOutputs`.
Stages that share a path, such as the writers of `atlas-cache.sqlite`, never
overlap and run in plan order. A stage with no declared paths (`sources`, which
rewrites `data/source`) runs alone, as does an `exclusive` stage. The two
registries are `exclusive`: they rewrite checked-in code that other stages
import. Add the paths of any new stage, or it will run alone.
`pnpm data:build --check-writes` runs one stage at a time and names any file a
stage changed outside its declared paths. Run it after adding or changing a stage.

When a stage fails, no new stage starts. Stages already running finish, so
their outputs are complete and recorded in the cache, and the build exits with
the first failing status.

The dataset compiler uses DuckDB to read and filter public health source CSVs.
It hashes the source files for cache tracking and passes the selected rows to
the shared Node loader.
For general health and housing tenure, DuckDB selects LSOA rows from census
CSVs before the shared loaders validate counts and calculate percentages.
For planning applications, DuckDB selects the published quarter before the
shared loader validates authority codes and application counts.
It also uses DuckDB to aggregate road collisions directly from the source CSVs,
validating the inputs and tracking their hashes for the dataset cache.
For the school performance datasets, DuckDB filters the source CSVs before
the shared loaders process the selected rows.
The English deprivation dataset uses the same reader to select source columns
before its loader computes the local-authority summaries.
For electricity and gas consumption, DuckDB filters rows without an authority
code or a consumption value before the shared loaders join population figures.
For the 2016 to 2019 local election CSVs, DuckDB selects English and Welsh
rows before the shared loader calculates party votes and winners.

The `area-search-index` stage uses DuckDB to deduplicate and order search
postings after applying the shared name normalisation rules. The standalone API
cache rebuild retains the Node implementation.

The `place-index` stage uses DuckDB to deduplicate and order name postings.
It shares place grouping and index publication with the Node compiler used by
the standalone API cache rebuild.

The `postcode-index` stage uses DuckDB through its Node package to read and
order the compressed source. It compiles and validates one district at a time,
storing temporary shards under `data/build/` until the SQLite database is
published.

The `postcode-counts` stage uses DuckDB through its Node package to aggregate
counts from the canonical SQLite database. It validates the source shards first
and checks that the database remains unchanged during the build. DuckDB must be
able to load its SQLite extension, which it downloads on first use if needed.
The standalone API cache rebuild still uses the Node implementation.

Stage commands live in the graph rather than package scripts. The API package's
`build` command bundles its server only. The root `build` command builds the
Next.js application using existing data and does not assemble release assets. `pnpm dev` verifies website data first and runs the
complete data build only when that verification fails or a rebuild is forced.

The build skips a stage when its inputs and outputs are unchanged. Its key
includes its command, local imports, declared `codeInputs`, shared configuration,
the size and mtime of raw files in `data/source/`, and upstream output digests.
The files it wrote under `data/build/` and `public/data/` must also be
unchanged. A stage's outputs are the files that changed within its declared
paths while it ran, so stages with separate paths can run at once. A stage
without declared paths is tracked across both trees and runs alone.

A stage's output digest hashes the contents of its output files, not their
mtimes. Each recorded file stores `{size, mtimeMs, sha256}`. A file is hashed,
in streamed chunks, only when no record holds that path with the same size and
mtime, so unchanged multi-gigabyte outputs such as `atlas.sqlite` are not read
again. The skip check compares size and mtime alone. A stage that rewrites
identical bytes therefore keeps its digest, and its dependants are skipped (early
cutoff). If it instead restores a shared file that a downstream stage had
changed, such as `atlas.sqlite`, that downstream stage is invalidated and
rebuilds.

`pipeline/build-data-code.mjs` uses esbuild's dependency metadata to trace local
imports, including workspace package sources, without executing builders.
Keys include runtime-affecting root TypeScript compiler options and the versions
of directly imported external packages resolved from installed manifests. Local
import resolution tracks path mappings. Transitive package versions and dynamic
imports that esbuild cannot see are not tracked, so declare additional files in
`codeInputs` when needed. Runner changes require a key version bump when they
change key semantics or output meaning. API runtime configuration is assigned to
the builders that read each file in `pipeline/build-data-code.mjs`. The source
release is tracked for precompile fingerprinting and when imported or declared. Package manifests, API
documentation and unimported shared code are excluded unless declared.
Ordinary UI files are excluded unless a builder imports them.
Builders that read code or templates directly from disk declare those paths in
`codeInputs` in the build graph. Include worker entry points there too. Added and
removed files under declared directories change the cache key. Generated files
are tracked as stage outputs rather than bundled as code inputs. Unresolved
local imports fail the check rather than reuse a stale result.

Only the `sources` download is never cached, as it can change any raw file and
needs the network. It is skipped, with no command run, when
`data/source/.source-release.json` names the release pinned in
`data-release.json` and every file still has its recorded stamp (the first check
`data:download` makes). Every other stage is cached, so a build where nothing
changed runs no stage.

The catalogue and website registries rewrite checked-in files. Those files are
their `requiredOutputs`, tracked by size, mtime and content like any output, so
deleting or editing one reruns its stage. Their definitions are imported by
path, so the whole definition directories are `codeInputs`. After a registry
writes code, the code hashes of later stages are computed again.

`place-index`, `area-search-index` and `postcode-counts` add tables to
`atlas-cache.sqlite`, which also holds other stages' tables and is rewritten by
copy and rename. Each lists the file as `shared`, so its bytes are not that
stage's output, and leaves a stamp at `data/build/.stamps/<stage>.json` holding
the cache component's generation and a hash of the stage's own tables (and, for
`postcode-counts`, its `payloads` row). The stamp is the stage's required
output and its digest, so the stage's readers rerun only when its tables
change. `atlas-sqlite` clears the stamps when it extends the cache, which
reruns all four. `atlas-cache-stamp` is the last writer and owns the file's
bytes, so any other change to it reruns that stage. Its script then checks that
the cache holds each stage's component for the current `atlas.sqlite`,
and fails with the stale stage's stamp removed if it does not.
`pipeline/build-data-cache.mjs` stores the cache in
`.cache/data-build/`. The scoped key format and the content-hash record format
each invalidate old entries once.
`--from` and `--no-cache` rerun the stages they select regardless.
Moving stage commands to the repository root also invalidates cached stages
once because the command is part of each key. The cache format remains at
version 4. Each stage record also keeps its latest command and total duration and
finish time, including failed runs. Skips preserve the previous timing.
`last-build.json` in the same directory records the latest build's start, finish,
and stage outcomes and durations. `--plan` shows available previous durations
and estimates the total for stages expected to run. The estimate can be partial
and actual stages may differ if rebuilt outputs are unchanged.

After a cache format bump or command change, `pnpm data:build --adopt` records existing outputs
against current keys without running any stage, hashing every adopted file once.
Use `--only <stage>` to select a stage and its prerequisites, or add `--plan` to
validate and preview adoption.
This trusts the user: it checks file presence, not whether the bytes were built
from current code or sources. Use it only when those outputs are known to be
valid. The never-cached `sources` download is skipped. Adoption refuses missing required files, empty declared output folders,
and missing files in the previous cache inventory. Keep the old stages.json
when upgrading: its output paths remain usable even if its version is obsolete.
Without an inventory or declared outputs, build the stage first. Adoption cannot
be combined with `--from` or `--no-cache`.

The `atlas-sqlite` stage writes the terrain catalogue to `data/build/atlas.sqlite`,
alongside catalogue datasets, relational areas, crosswalk source/target rows and
named locations with membership tables and lazy geometry. Indexed location
projections live in the local `atlas-cache.sqlite`. The API reads these
directly. Their JSON outputs remain build and release intermediates. Named
locations compile from area JSON before the shared SQLite database is written.
The statistics vocabulary and read-path stages write JSON under `data/build/`.
The read-path stage compares statistics rows with independently compiled
observation values before assembly. The API reads both files from the deployed build. Other API
loaders still read their JSON outputs.
See [data/build/README.md](data/build/README.md) for the database schema.

## Rebuilding after a change

| You changed                            | Run                                                     |
| -------------------------------------- | ------------------------------------------------------- |
| Shared datasets or their loaders       | `pnpm data:build --from datasets`                       |
| How the API compiles geography or data | `pnpm data:build`, then `pnpm --dir services/api build` |
| Anything, before a release             | `pnpm check:full`                                       |

`pnpm check` is the quick set CI runs. It needs no generated data: unit tests
that import a generated dataset get a small sample from `tests/fixtures/datasets`
instead. Tests that read the real generated data, or the raw data in `data/source/`,
live in `tests/built/` and run locally only. First follow the build order in
[deploy/README.md](deploy/README.md), including the website build that generates
SEO artifacts. Then `pnpm check:full` runs the quick checks, verifies local
generated data, and runs the built website and API tests. It needs `data/source/`
restored and both products built, with the API running for the API's own
tests. The check does not build or deploy either product.

## Current-build provenance

`data/build/artifacts/atlas-release.json` identifies the current build. It records
repository-relative paths and SHA-256 hashes of the stored `atlas.sqlite`, API
PMTiles, and JSON catalogues that still have runtime readers. The export and
map catalogues record the hashes of observation and flat boundary downloads. Gzipped files are identified by their stored bytes. The file has no
historical snapshots or per-resource comparison index.

Migrated SQLite data is covered by the database hash. JSON used only by the
SQLite writer is a build intermediate, not a release dependency. Projection
intermediates live under `data/build/location-projections/`. Geography catalogue
intermediates live under `data/build/geography/`; the `geography-catalogues` stage
adds them to the database after analysis compilation. Runtime readers and the
corresponding evidence document endpoints read SQLite. Consumers can keep a
build id for provenance and use download ETags or export lists for syncing.

The derived-boundary and source-inventory JSON summaries had no readers beyond
the old fingerprint builder. Their compilers no longer write them; derived
geometries and the runtime geography catalogue remain.

The pipeline builds search, location projection and postcode-count tables in
`data/build/atlas-cache.sqlite`. Deploy it alongside the canonical database from
the same build. The website's pages and lookups are in `data/build/website-assets.sqlite`,
which only the Next.js server needs. The source data release contains only raw inputs. See
[generated API data](docs/api-generated-data.md).
