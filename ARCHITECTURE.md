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

Both answer geography questions: which local authority a ward sits in, what a
ward became after a boundary review, which LSOAs a parish covers. The API's
geography resolver is the one place those answers are decided. The atlas does
not work them out for itself. It reads the resolver's answers, compiled into
small committed files, so the map always says what the API would say.

```
services/api                       the resolver: decides every answer
    │  build-time scripts at the root ask it questions
    ▼
public/data/datasets/*.json        its answers, compact and committed
    │
    ▼
atlas                              reads the answers, never the resolver
```

The resolver itself is far too large to ship to a browser, and the atlas never
imports it.

## Layout

```
/                       the atlas (Next.js): app/, components/, lib/
packages/geography/     shared geography code: lineage, containment file
                        formats, geometry substitutions, grid offsets
packages/catalogue/     shared catalogue code: the register of corrections
services/api/           the API: src/, scripts/, config/, openapi.yaml
scripts/                the atlas's build scripts, including the ones that
                        read the resolver
data/                   raw source files, restored from the data release
public/data/            the atlas's compiled data, served by Vercel
```

## Where the data lives

| Where                  | What                                                                     | In git                        | Made by                                                              |
| ---------------------- | ------------------------------------------------------------------------ | ----------------------------- | -------------------------------------------------------------------- |
| `data/`                | Raw files as publishers supplied them                                    | No                            | `pnpm data:download`, from the release pinned in `data-release.json` |
| `services/api/public/` | The API's build: the boundary archive, crosswalks, indexes and downloads | No                            | `pnpm --dir services/api build`, run where the API is served         |
| `public/data/`         | The atlas's compiled datasets and boundaries                             | Yes, so Vercel need not build | `pnpm precompile` and `pnpm boundaries:compile`                      |

Some of the files in `public/data/datasets/` are the resolver's answers rather
than compiled datasets, written by scripts that read the API's build:

| File                                                                                                               | Written by                                                  |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `area-lineage.json`                                                                                                | `pnpm lineage:build`                                        |
| `boundary-mappings.json`, `parish-lad-mappings.json`, `lsoa-lad-mappings-*.json`, `constituency-lad-overlaps.json` | `pnpm containment:build`                                    |
| `docs-catalogue.json`                                                                                              | `pnpm docs:catalogue`, the last step of the API's own build |
| `places/`                                                                                                          | `pnpm places:build`                                         |
| `map-figures.json`, `ranking-pages.json`, `rankings/*.json`                                                        | `pnpm seo:build`, from the compiled datasets                |

`map-figures.json` and the rankings are not the resolver's: they hold the
headline figure each map page's search snippet leads with, and each map's
areas ranked for the `/maps/{place}/{map}` pages. They are compiled from the
datasets because those are too large to load while a page renders, and a data
test fails while they are stale.

`places/` holds a profile of every ward, local authority and constituency the
resolver holds, current or abolished, and of every named place, for the
`/places/{code}` pages: each one's outline, history across boundary releases,
what it sits within, contains and borders, and which datasets publish figures
for it. Area profiles are sharded by code, and the pages read them from disk
rather than importing them, so the 50 MB of profiles stays out of the bundle;
`next.config.ts` traces the folder into the route. Councils, constituencies
and named places are built ahead of time, and wards render on first visit.

Because the API's build is not committed, the lineage, containment and place
files are recorded in `public/data/datasets/resolver-projections.json` with the API
release each came from and its hash. `pnpm precompile:verify`, which every
website build runs, fails if one of them changed after it was written, or if
they came from different API builds. The docs catalogue records the hashes of
the API artifacts it was built from in its own file.

Everything in `services/api/public` is build output, so its layout on disk is
the API's own business. Clients reach every file through a route, and a route
can find its file anywhere. What freezes at launch is the routes, their
parameters and what they return.

## Which way code may depend

```
atlas ──────────────┐
                    ├──► packages/*
services/api ───────┘

scripts/ (atlas build only) ──► services/api   (as @uk-data-atlas/api/catalogues)
```

- The atlas and the API share code only through `packages/`. The API never
  imports the atlas's `lib/`, and the atlas never imports the API at runtime.
  The website does read one API file, `services/api/openapi.yaml`, for its API
  reference; `.vercelignore` keeps everything else in `services/api` out of
  the deployment.
- Only the atlas's build scripts depend on the API, through its
  `@uk-data-atlas/api/catalogues` entry point, to read the resolver.
- A package holds code only. It reads no files, knows no paths and is safe to
  bundle into a browser: each consumer loads its own data and passes it in.
  Its tsconfig rejects Node and DOM types and the atlas's `@/` aliases, and
  `tests/packages/packageImports.test.ts` rejects any import its
  `package.json` does not declare.

Import a package by name (`@uk-data-atlas/geography`), never by a relative
path. Packages ship TypeScript source: Turbopack and `tsx` both compile it, so
there is no build step.

## Rebuilding after a change

| You changed                            | Run                                                                                                                                       |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| The atlas's datasets or their loaders  | `pnpm precompile`, then `pnpm seo:build`                                                                                                  |
| How the API compiles geography or data | `pnpm --dir services/api build`, then `pnpm lineage:build` and `pnpm containment:build`, then `pnpm precompile`, then `pnpm places:build` |
| Anything, before a release             | `pnpm check:full`                                                                                                                         |

`pnpm check` is the quick set CI runs. `pnpm check:full` rebuilds everything
from the raw data and needs `data/` restored.
