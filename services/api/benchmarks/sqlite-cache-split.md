# SQLite canonical/cache split

Measured on 2026-10-25 with Node 26.12.1 and a 2560 MiB JavaScript heap limit.
The existing precompiled artifacts and database were copied from the main checkout
with `cp --reflink=auto`. No precompile stage ran. The supplied database predated
observations-as-rows, integer area IDs and postcode columns. Existing SQLite
publishers rebuilt those layouts before recording the normalized single-file
baseline. The split used the same canonical records and rebuilt its cache solely
from SQLite.

## Storage and cache build

| File                       |  Before bytes |   After bytes |
| -------------------------- | ------------: | ------------: |
| Distributed `atlas.sqlite` | 1,111,654,400 | 1,013,780,480 |
| Local `atlas-cache.sqlite` |             0 |    97,869,824 |
| Total                      | 1,111,654,400 | 1,111,650,304 |

The distributed database shrank by 97,873,920 bytes, or 8.8%. The cache-only
build took 127.91 seconds wall time with peak RSS 1,883,236 KiB. The build's own
timer reported 127,416.66 ms. This is a rebuild cost, excluded from API startup.
Docker performs it before starting workers; direct API startup reports the rebuild
command when a required component is missing or stale.

`sqlite-cache-split-before.json` records `SELECT name, sum(pgsize) FROM dbstat GROUP BY name`
and all baseline table definitions. `sqlite-cache-split-audit.json` classifies
every table with table/index allocation, writer, reader and rationale. The codeq
symbol inventory is in `sqlite-cache-table-code-index.txt`. Application cache tables
account for 97,820,672 bytes before the split. Their metadata payloads move too.
SQLite's own indexes and statistics remain with the B-trees they describe.

Source dataset payloads remain canonical: normalized observations do not preserve
every source field. Public catalogue/provenance payloads, named-location geometry,
postcode placements and normalized observation rows are also user data.
`observation_artifacts` is absent after the prior normalization. No `website_assets`
table was present in the supplied database. Website JSON generation is unchanged.

## Response equivalence

The streaming comparison checked 126 tables/payload entries, comprising 12,017,932
rows and payload entries, with **0 mismatches**. It checks every stored value,
including content hashes and compressed projection/postcode columns. Projection
inventory whitespace is compared after JSON parsing because runtime serves its
fields, not its original file formatting. HTTP body hashes and ETags independently
match for all 12 routes below, with **0 mismatches**.

Reproduce against a normalized pre-split database and the generated profiles:

```sh
NODE_OPTIONS=--max-old-space-size=2560 pnpm exec tsx services/api/scripts/compare-atlas-cache.ts data/baseline-normalized.sqlite services/api services/api/benchmarks/sqlite-cache-split-comparison.json services/api/benchmarks/sqlite-cache-split-http-before.json services/api/benchmarks/sqlite-cache-split-http-after.json
```

A mismatch or empty comparison exits nonzero. The baseline database is a local
measurement input, not a committed artifact.

## Startup and first access

One fresh Node process per version, without flushing the operating system's page
cache. Timing starts before catalogue loading and ends when the server listens;
module import time is excluded. Evidence-document loading is disabled in both
versions because the copied evidence catalogue has stale upstream hashes. Routes
run sequentially, so later requests may reuse earlier lazy stores. These single
samples describe this run and do not establish a performance improvement.

Catalogue startup: 2035.69 ms before, 1981.89 ms after.

| Route                                                                | Before ms | After ms | Status | Body/ETag |
| -------------------------------------------------------------------- | --------: | -------: | ------ | --------- |
| `/v1/areas?limit=5`                                                  |     96.27 |   151.07 | 200    | identical |
| `/v1/areas?geography=ward&limit=5`                                   |     36.55 |    29.87 | 200    | identical |
| `/v1/places?q=Manchester`                                            |     55.93 |   108.63 | 200    | identical |
| `/v1/places?q=Ynys%20Mon`                                            |      3.98 |     3.09 | 200    | identical |
| `/v1/areas/localAuthority/2023-05-uk-bgc-v2/E08000003`               |      8.07 |     7.57 | 200    | identical |
| `/v1/locations/greater-manchester/members?release=2023-05-uk-bgc-v2` |      8.24 |    16.34 | 200    | identical |
| `/v1/postcodes/M11AA`                                                |    114.94 |   108.03 | 200    | identical |
| `/v1/postcodes/SW1A1AA?view=compact`                                 |     54.42 |    37.16 | 200    | identical |
| `/v1/data/population?geography=localAuthority`                       |     33.26 |    27.32 | 200    | identical |
| `/v1/data/population/value?place=Manchester`                         |     26.00 |    11.20 | 200    | identical |
| `/v1/crosswalks`                                                     |      4.86 |     2.44 | 200    | identical |
| `/v1/locations?limit=5`                                              |     29.50 |    26.94 | 200    | identical |

Profiles are in `sqlite-cache-split-http-{before,after}.json`. The retained profiler
accepts a source checkout, output path and optional API root:

```sh
NODE_OPTIONS=--max-old-space-size=2560 pnpm exec tsx services/api/scripts/profile-atlas-cache-http.ts . services/api/benchmarks/sqlite-cache-split-http-after.json
```

A non-200 route exits nonzero. For the old run, use an unchanged source checkout
and API root containing the normalized single-file database and the same public
artifacts.

## Distribution audit

`git grep atlas.sqlite`, Compose, Docker, `.github/workflows`, release scripts and
the download path were inspected. The Atlas manifest explicitly hashes only the
canonical SQLite file. `scripts/data-release.mjs` packages `data/source`, not build
outputs, and the download script restores source data. Docker ignores `data/` at
build time and now mounts canonical SQLite read-only with a separate writable
cache volume. It rebuilds the cache before workers start. No cache file is added
to a publication or download archive.

## Checks

- `pnpm install` completed in this worktree, without linking `node_modules`.
- API unit suite uses `npx tsx --test --test-concurrency=2 tests/*.test.ts`.
  The final run has 952 passes, eight failures and one skip, 961 tests total.
  The eight `buildData.test.ts` failures also occur on main.
- Focused SQLite/comparator/publication tests passed. The built artifact-freshness
  suite found stale copied evidence-document and validation-report hashes.
- Built reader/HTTP suites were attempted. Several cannot initialize because the
  copied evidence documents were not built from the current data catalogue.
  These are reported as failures, not successful runtime coverage.
- `npx tsc --noEmit` in `services/api` passed.
- `pnpm --dir services/api build` passed, including the bundled cache command.
- Build-cache and release-path suites: 15 tests passed.
- `docker compose -f services/api/compose.yaml config --quiet` passed. A Docker image
  was not built or run.

No full precompile, website test suite or unrelated formatting fix ran.
