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
packages/map-tiles/     the boundary tiler: shared-arc generalisation and
                        PMTiles archives, for the API and the precompile
services/api/           the API: src/, scripts/, config/, openapi.yaml
scripts/                build orchestration and file readers for both products
data/                   raw source files, restored from the data release
public/data/            the atlas's compiled data, served by the website
```

## Where the data lives

| Where                  | What                                                                     | In git | Made by                                                                  |
| ---------------------- | ------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------ |
| `data/`                | Raw files as publishers supplied them                                    | No     | `pnpm data:download`, from the release pinned in `data-release.json`     |
| `services/api/public/` | The API's build: the boundary archive, crosswalks, indexes and downloads | No     | `pnpm --dir services/api build`, run where the API is served             |
| `public/data/`         | The atlas's compiled datasets, boundaries and boundary vector tiles      | No     | `pnpm precompile`, `pnpm boundaries:compile` and `pnpm boundaries:tiles` |

`map-figures.json`, `ranking-pages.json` and `rankings/*.json` hold map
headlines and ranked areas, compiled by `pnpm seo:build` from the datasets.
Rankings read ward areas from the website's copy of the `ward-areas` page.

The API builds website artifacts with `pnpm --dir services/api build:atlas-pages`.
That stage reads only the areas, crosswalks, geometry, named locations and
catalogue manifests it uses, not the API's release manifest. It stores gzipped files and a manifest under
`services/api/public/atlas-pages/` and `atlas-pages.json`, and serves them at
`/v1/atlas-pages/{page-id}.json`. `pnpm atlas-data:copy` copies them to
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
stage compiles every catalogue dataset once into `compiled/datasets/` (see
[compiled/README.md](compiled/README.md)). The API's `api-datasets` stage copies
them into `services/api/public/datasets/`, beside the gazetteer it compiles, and
writes boundary assets into `services/api/public/source-data/boundaries/`. The
website precompile copies the same files into `public/data/datasets/`. The data catalogue, named
locations and atlas pages consume these API-owned inputs. File reading and
output writing stay in the build scripts; the package only transforms supplied
contents.

The atlas's containment and lineage lookups (`area-lineage`,
`boundary-mappings`, `parish-lad-mappings`, `lsoa-lad-mappings-{year}` and
`constituency-lad-overlaps`) are not in the repository. The API's build
compiles them with `@uk-data-atlas/geography` for the boundary releases
`@uk-data-atlas/catalogue` lists, and also serves them at
`/v1/atlas-lookups/{id}.json`. The website never reads them from the API.
`pnpm atlas-data:copy`, the first step of `pnpm precompile`, copies them from
the API's build output on disk into the gitignored `public/data/atlas-lookups/`.
The browser fetches them from the website there, and the precompile cuts
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
  reference, and the atlas lookups and pages `pnpm atlas-data:copy` takes from
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

| Command                            | Builds                                                          |
| ---------------------------------- | --------------------------------------------------------------- |
| `pnpm data:build --target api`     | Every API stage. `pnpm --dir services/api build:data` runs this |
| `pnpm data:build --target website` | Only the stages the website's data needs, then its datasets     |
| `pnpm data:build`                  | Both                                                            |

A target runs only the stages its outputs depend on, so building one target
and then the other gives the same output as building both. `--plan` lists the
stages without running them, and `--from <stage>` runs a stage and only the
stages after it.

The build skips a stage that ran before when nothing it reads has changed:
the repo's code, the size and mtime of every file in `data/`, its command, and
the outputs of the stages it depends on. The files it wrote under `compiled/`,
`public/data/` and `services/api/public/` must also be unchanged. So once one
target is built, the other reruns none of the stages they share, and a second
build of either runs only `download`. A code change reruns every stage.
`scripts/build-data-cache.mjs` keeps this in `.cache/data-build/`. `--from`
and `--no-cache` rerun the stages they select regardless.

The `atlas-sqlite` stage writes the terrain catalogue to `compiled/atlas.sqlite`,
which the API reads directly. Other API loaders still read their JSON outputs.
See [compiled/README.md](compiled/README.md) for the database schema.

## Rebuilding after a change

| You changed                            | Run                                                             |
| -------------------------------------- | --------------------------------------------------------------- |
| Shared datasets or their loaders       | `pnpm data:build --from datasets`, then `pnpm seo:build`        |
| How the API compiles geography or data | `pnpm data:build`, then `pnpm --dir services/api build:runtime` |
| Anything, before a release             | `pnpm check:full`                                               |

`pnpm check` is the quick set CI runs. It needs no generated data: unit tests
that import a generated dataset get a small sample from `tests/fixtures/datasets`
instead. Tests that read the real generated data, or the raw data in `data/`,
live in `tests/built/` and run locally only. First follow the build order in
[deploy/README.md](deploy/README.md), including the website build that generates
SEO artifacts. Then `pnpm check:full` runs the quick checks, verifies local
precompiled data, and runs the built website and API tests. It needs `data/`
restored and both products built, with the API running for the API's own
tests. The check does not build or deploy either product.
