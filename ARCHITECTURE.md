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
services/api/           the API: src/, scripts/, config/, openapi.yaml
scripts/                build orchestration and file readers for both products
data/                   raw source files, restored from the data release
public/data/            the atlas's compiled data, served by the website
```

## Where the data lives

| Where                  | What                                                                     | In git | Made by                                                              |
| ---------------------- | ------------------------------------------------------------------------ | ------ | -------------------------------------------------------------------- |
| `data/`                | Raw files as publishers supplied them                                    | No     | `pnpm data:download`, from the release pinned in `data-release.json` |
| `services/api/public/` | The API's build: the boundary archive, crosswalks, indexes and downloads | No     | `pnpm --dir services/api build`, run where the API is served         |
| `public/data/`         | The atlas's compiled datasets and boundaries                             | No     | `pnpm precompile` and `pnpm boundaries:compile`                      |

`map-figures.json`, `ranking-pages.json` and `rankings/*.json` hold map
headlines and ranked areas, compiled by `pnpm seo:build` from the datasets.
Rankings fetch ward areas from the API instead of reading place files.

The API builds website artifacts with `pnpm --dir services/api build:atlas-pages`,
the final stage of its data build. It stores gzipped files and a manifest under
`services/api/public/atlas-pages/` and `atlas-pages.json`, and serves them at
`/v1/atlas-pages/{page-id}.json`:

| Page id               | Contents                                                   |
| --------------------- | ---------------------------------------------------------- |
| `places-index`        | Every place and the boundary release lists                 |
| `places-area-{shard}` | Area profiles, sharded by code                             |
| `places-named-{id}`   | A named place profile                                      |
| `place-facts`         | Median age and ethnicity by code                           |
| `ward-areas`          | Ward areas used by ranking recipes                         |
| `docs-catalogue`      | Datasets, measures, exports and boundary releases for docs |

The website server fetches these artifacts with a one-day revalidation interval.
Current councils, constituencies and named places prerender during the website
build; wards render on first visit. Place search fetches the index from the API
on focus. Profiles and facts no longer need file tracing or committed copies.
An unavailable API fails rendering rather than returning a false missing place.

The API builds from raw `data/` without `public/data/`. Its `datasets` stage
uses `@uk-data-atlas/datasets` to compile datasets and the gazetteer into
`services/api/public/datasets/`, and boundary assets into
`services/api/public/source-data/boundaries/`. The data catalogue, named
locations and atlas pages consume these API-owned inputs. File reading and
output writing stay in the build scripts; the package only transforms supplied
contents.

The atlas's containment and lineage lookups (`area-lineage`,
`boundary-mappings`, `parish-lad-mappings`, `lsoa-lad-mappings-{year}` and
`constituency-lad-overlaps`) are not in the repository. The API's build
compiles them with `@uk-data-atlas/geography` for the boundary releases
`@uk-data-atlas/catalogue` lists, and serves them at
`/v1/atlas-lookups/{id}.json`. The browser fetches them there, and
`pnpm lookups:fetch`, the first step of `pnpm precompile`, copies them to the
gitignored `.cache/atlas-lookups/` for the precompile to cut chunks with. Set
`NEXT_PUBLIC_ATLAS_API_ORIGIN` to read a local API instead of
`https://api.ukdataatlas.com`. Deploy the API before the website, so the
chunks a website build cuts agree with the lookups its browser fetches.

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
  The website does read one API file, `services/api/openapi.yaml`, for its API
  reference; `.vercelignore` keeps everything else in `services/api` out of
  the deployment.
- A package holds code only. It reads no files and is safe to
  bundle into a browser: each consumer loads its own data and passes it in.
  Its tsconfig excludes Node types and the atlas's `@/` aliases, and
  `tests/packages/packageImports.test.ts` rejects any import its
  `package.json` does not declare.

Import a package by name (`@uk-data-atlas/geography`), never by a relative
path. Packages ship TypeScript source: Turbopack and `tsx` both compile it, so
there is no build step.

## Rebuilding after a change

| You changed                            | Run                                                                                                               |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Shared datasets or their loaders       | `pnpm --dir services/api build:data --from datasets`, deploy the API, then `pnpm precompile` and `pnpm seo:build` |
| How the API compiles geography or data | `pnpm --dir services/api build`, deploy the API, then `pnpm precompile`                                           |
| Anything, before a release             | `pnpm check:full`                                                                                                 |

`pnpm check` is the quick set CI runs. It needs no generated data: unit tests
that import a generated dataset get a small sample from `tests/fixtures/datasets`
instead. Tests that read the real generated data, or the raw data in `data/`,
live in `tests/built/` and run locally only. `pnpm check:full` rebuilds
everything from the raw data, runs them too, and needs `data/` restored.
