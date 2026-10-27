# Architecture

How the repository is laid out, where its data lives, and which way its code
may depend. What the API is for, and what to build next, is in
[services/api/DIRECTION.md](services/api/DIRECTION.md).

## Two products, one geography engine

The repository holds two products:

- **The atlas**, the Next.js website at the root. It is the priority, and it
  deploys to Vercel.
- **The API**, a Node service in `services/api`. It deploys to its own
  server, which also builds its data.

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
shared/                 server-only readers of the compiled release
packages/map-tiles/     the boundary tiler: shared-arc generalisation and
                        PMTiles archives, for the API and the website data build
services/api/           the API: src/, scripts/, config/, openapi.yaml
services/mcp/           the MCP server: a read-only HTTP client of the public API
scripts/                build orchestration and file readers for both products
data/
  source/               raw source files, restored from the data release
  build/                shared generated datasets and atlas.sqlite
public/data/            the atlas's compiled data, served by the website
```

## Where the data lives

| Where                   | What                                                           | In git      | Made by                                                                                            |
| ----------------------- | -------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| `data/source/`          | Raw files as publishers supplied them                          | No          | `pnpm data:download`, from the release pinned in `data-release.json`                               |
| `data/build/`           | Shared generated datasets and `atlas.sqlite`                   | README only | `pnpm data:build`                                                                                  |
| `data/build/artifacts/` | Remaining generated API catalogues and downloads               | No          | `pnpm data:build`                                                                                  |
| `public/data/`          | The atlas's compiled datasets, boundary properties and PMTiles | No          | `pnpm data:build`, `pnpm data:build --only boundaries` and `pnpm data:build --only boundary-tiles` |

Raw release archives keep their paths relative to the source root. The existing
pinned release restores into `data/source/` without republishing. For an existing
checkout, move its raw folders and `.source-release.json` from `data/` into
`data/source/`, leaving `data/build/` in place.

`map-figures.json`, `ranking-pages.json` and `rankings/*.json` hold map
headlines and ranked areas, compiled by `pnpm data:build --only seo` from the datasets.
Rankings read the precomputed `ward-areas` page from SQLite.

The data build compiles website artifacts with `pnpm data:build --only atlas-pages`.
That stage reads only the areas, crosswalks, geometry, named locations and
catalogue manifests it uses, not the API's release manifest. It stores gzipped files and a manifest under
`data/build/atlas-assets/atlas-pages/` and `atlas-pages.json`. The API serves them at
`/v1/atlas-pages/{page-id}.json`. `pnpm data:build --only website-lookups` stores their
precompressed bytes in `data/build/atlas.sqlite`. The website reads them directly
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
metadata and exact payload bytes in `data/build/atlas.sqlite`. Fuel poverty also
has relational catalogue observation rows. The Next.js versioned reader
reconstructs its original JSON from those rows; other datasets still read the
stored payload. The API catalogue
compiler and atlas pages read it directly through the server-only reader in
`shared/atlasSqlite.ts`. The `api-datasets` stage only builds
gazetteer core and boundary assets under `data/build/artifacts/source-data/`.
Named locations consume that gazetteer. The Next.js server also reads SQLite
and passes dataset URLs containing their payload SHA-256 to the browser. Its
`/data/catalogue/<sha256>/<output>.json` route serves exact JSON with one-year
immutable caching and negotiated gzip compression. Neither product fetches
catalogue datasets from the other product.

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
website ────────────┼──► packages/* and shared/
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
- `clients/` reads `services/api/openapi.yaml` to generate typed API clients.
  Nothing depends on them, and they import no project code.
- Other generated API files remain under `data/build/artifacts/` for now. They
  sit beside `atlas.sqlite` so the pipeline writes only under `data/build/`, and
  `shared/dataLayout.ts` is the one place that knows the location.
- A package holds code only. It reads no files and is safe to
  bundle into a browser: each consumer loads its own data and passes it in.
  Its tsconfig excludes Node types and the atlas's `@/` aliases, and
  `tests/packages/packageImports.test.ts` rejects any import its
  `package.json` does not declare.

Import a package by name (`@uk-data-atlas/geography`), never by a relative
path. Packages ship TypeScript source: Turbopack and `tsx` both compile it, so
there is no build step.

## One data build

`scripts/build-data-graph.mjs` lists every data build stage for both
products, with its dependencies. `pnpm data:build` builds all API and website
data in dependency order, including SQLite, PMTiles and SEO. Product targets
are no longer supported.

`--plan` lists the stages without running them. `--only <stage>` builds one
stage and its prerequisites, reusing cached results where valid. `--from <stage>` rebuilds
a stage and its downstream consumers using existing upstream outputs.
These two options cannot be combined. For example:

```sh
pnpm data:build --only boundary-tiles
pnpm data:build --only atlas-sqlite --plan
pnpm data:build --from datasets
```

Stage commands live in the graph rather than package scripts. The API package's
`build` command bundles its server only. The root `build` command builds the
Next.js application using existing data and does not assemble release assets. `pnpm dev` verifies website data first and runs the
complete data build only when that verification fails or a rebuild is forced.

The build skips a stage when its inputs and outputs are unchanged. Its key
includes its command, local imports, declared `codeInputs`, shared configuration,
the size and mtime of raw files in `data/source/`, and upstream output digests.
The files it wrote under `data/build/` and `public/data/` must also be
unchanged.

A stage's output digest hashes the contents of its output files, not their
mtimes. Each recorded file stores `{size, mtimeMs, sha256}`. A file is hashed,
in streamed chunks, only when no record holds that path with the same size and
mtime, so unchanged multi-gigabyte outputs such as `atlas.sqlite` are not read
again. The skip check compares size and mtime alone. A stage that rewrites
identical bytes therefore keeps its digest, and its dependants are skipped (early
cutoff). If it instead restores a shared file that a downstream stage had
changed, such as `atlas.sqlite`, that downstream stage is invalidated and
rebuilds.

`scripts/build-data-code.mjs` uses esbuild's dependency metadata to trace local
imports, including workspace package sources, without executing builders.
API runtime configuration, TypeScript configuration, the pinned data release,
build scripts and the lockfile remain common inputs. The lockfile conservatively
covers transitive dependencies, peer variants and dynamically loaded workers.
Package manifests, API documentation and unimported shared code are excluded.
Ordinary UI files are excluded unless a builder imports them.
Builders that read code or templates directly from disk declare those paths in
`codeInputs` in the build graph. Include worker entry points there too. Added and
removed files under declared directories change the cache key. Generated files
are tracked as stage outputs rather than bundled as code inputs. Unresolved
local imports fail the check rather than reuse a stale result.

Download, catalogue registry generation, source documentation and website
registry generation always run. Their generated code is inspected again before
later stage keys are computed. `scripts/build-data-cache.mjs` stores the cache in
`.cache/data-build/`. The scoped key format and the content-hash record format
each invalidate old entries once.
`--from` and `--no-cache` rerun the stages they select regardless.

After a cache format bump, `pnpm data:build --adopt` records existing outputs
against current keys without running any stage, hashing every adopted file once.
Use `--only <stage>` to select a stage and its prerequisites, or add `--plan` to
validate and preview adoption.
This trusts the user: it checks file presence, not whether the bytes were built
from current code or sources. Use it only when those outputs are known to be
valid. Never-cacheable stages are skipped, including downloads and registry
updates. Adoption refuses missing required files, empty declared output folders,
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
Other API loaders still read their JSON outputs.
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

The API stores rebuildable search, location projection and postcode-count tables
in the local `data/build/atlas-cache.sqlite`. This file is excluded from releases
and images. Consumers run `pnpm --dir services/api build:cache` against the
canonical database after downloading it. See [generated API data](docs/api-generated-data.md).
