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
scripts/                build orchestration and file readers for both products
data/
  source/               raw source files, restored from the data release
  build/                shared generated datasets and atlas.sqlite
public/data/            the atlas's compiled data, served by the website
```

## Where the data lives

| Where                  | What                                                                     | In git      | Made by                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------- |
| `data/source/`         | Raw files as publishers supplied them                                    | No          | `pnpm data:download`, from the release pinned in `data-release.json`                                                |
| `data/build/`          | Shared generated datasets and `atlas.sqlite`                             | README only | `pnpm data:build`                                                                                                   |
| `services/api/public/` | The API's build: the boundary archive, crosswalks, indexes and downloads | No          | `pnpm data:build --target api`                                                                                      |
| `public/data/`         | The atlas's compiled datasets, boundaries and boundary vector tiles      | No          | `pnpm data:build --target website`, `pnpm data:build --only boundaries` and `pnpm data:build --only boundary-tiles` |

Raw release archives keep their paths relative to the source root. The existing
pinned release restores into `data/source/` without republishing. For an existing
checkout, move its raw folders and `.source-release.json` from `data/` into
`data/source/`, leaving `data/build/` in place.

`map-figures.json`, `ranking-pages.json` and `rankings/*.json` hold map
headlines and ranked areas, compiled by `pnpm data:build --only seo` from the datasets.
Rankings read ward areas from the website's copy of the `ward-areas` page.

The API builds website artifacts with `pnpm data:build --only atlas-pages`.
That stage reads only the areas, crosswalks, geometry, named locations and
catalogue manifests it uses, not the API's release manifest. It stores gzipped files and a manifest under
`services/api/public/atlas-pages/` and `atlas-pages.json`, and serves them at
`/v1/atlas-pages/{page-id}.json`. `pnpm data:build --only website-lookups` copies them to
`public/data/atlas-pages/{page-id}.json` for the website:

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
metadata and exact payload bytes in `data/build/atlas.sqlite`. The API catalogue
compiler and atlas pages read it directly through the server-only reader in
`shared/atlasSqlite.ts`. The `api-datasets` stage only builds
gazetteer core and boundary assets under `services/api/public/source-data/`.
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
`constituency-lad-overlaps`) are not in the repository. The API's build
compiles them with `@uk-data-atlas/geography` for the boundary releases
`@uk-data-atlas/catalogue` lists, and also serves them at
`/v1/atlas-lookups/{id}.json`. The website never reads them from the API.
The website pipeline runs `pnpm data:build --only website-lookups` to copy them from
the API's build output on disk into the gitignored `public/data/atlas-lookups/`.
The browser fetches them from the website there, and the website data build cuts
chunks with the same files, so the two agree. The place profiles, place facts,
ward areas and docs catalogue the API build compiles into `atlas-pages` are
copied the same way to `public/data/atlas-pages/`. Building and running the
website needs the API's data build on disk, never a running API.

Everything in `services/api/public` is build output, so its layout on disk is
the API's own business. Clients reach every file through a route, and a route
can find its file anywhere. What freezes when v1 leaves early access is the routes, their
parameters and what they return.

## Which way code may depend

```
atlas ──────────────┐
                    ├──► packages/*
services/api ───────┘
```

- The atlas and API share domain code through `packages/`. Their build
  scripts also reuse Node file adapters in root `scripts/`. The API never
  imports the atlas's `lib/`, and the website never imports API project code.
  The website does read API files: `services/api/openapi.yaml` for its API
  reference, and the atlas lookups and pages `pnpm data:build --only website-lookups` takes from
  the API's build output; `.vercelignore` keeps everything else in `services/api` out of
  the deployment.
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
products, with its dependencies. `pnpm data:build` runs them in order, and
`--target` limits it to one product:

| Command                            | Builds                                            |
| ---------------------------------- | ------------------------------------------------- |
| `pnpm data:build --target api`     | Every API data stage                              |
| `pnpm data:build --target website` | Website data, including boundaries, tiles and SEO |
| `pnpm data:build`                  | Both                                              |

A target runs only the stages its outputs depend on, so building one target
and then the other gives the same output as building both. `--plan` lists the
stages without running them. `--only <stage>` builds one stage and its
prerequisites, reusing cached results where valid. `--from <stage>` rebuilds
a stage and its downstream consumers using existing upstream outputs.
These two options cannot be combined. For example:

```sh
pnpm data:build --only boundary-tiles
pnpm data:build --only atlas-sqlite --plan
pnpm data:build --from datasets
```

Stage commands live in the graph rather than package scripts. The API package's
`build` command bundles its server only. The root `build` command builds the
Next.js application using existing data.

The build skips a stage that ran before when nothing it reads has changed:
the repo's code, the size and mtime of raw files in `data/source/`, its command, and
the outputs of the stages it depends on. The files it wrote under `data/build/`,
`public/data/` and `services/api/public/` must also be unchanged. So once one
target is built, the other reuses unchanged compiled stages. Download and
catalogue registry generation always run. Website builds also regenerate source
documentation and the website registry. These generated source files live outside
the compiled output cache. A code change reruns every compiled stage.
`scripts/build-data-cache.mjs` keeps this in `.cache/data-build/`. `--from`
and `--no-cache` rerun the stages they select regardless.

The `atlas-sqlite` stage writes the terrain catalogue to `data/build/atlas.sqlite`,
alongside catalogue datasets, relational areas, crosswalk source/target rows and
named locations with membership tables and lazy geometry, and indexed location
projections. The API reads these
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

`services/api/public/atlas-release.json` identifies the current build. It records
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
