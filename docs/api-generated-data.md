# Generated API data

This audit follows the postcode and API observation migrations to
`data/build/atlas.sqlite`. It describes consumers in the source, rather than
assuming that every file left by an older local build is still required.

## Canonical SQLite and local API cache

`data/build/atlas.sqlite` is the distributed database. It contains area identities,
crosswalks, named locations and their geometry, observation rows and dictionaries,
postcode records and area columns, source dataset payloads, and public catalogue
metadata. Source dataset payloads retain fields absent from observation contracts;
they are not interchangeable copies of those contracts.

`data/build/atlas-cache.sqlite` contains `area_search_*`, `place_index_*`,
`location_projection_*`, `postcode_counts`, and the projection and counts metadata
in its own `payloads` table. These are API accelerators rebuilt from canonical
SQLite data. The base SQLite build writes the projection cache, and the search
and postcode-count stages publish their own cache components. Publishers replace
the cache atomically and leave the canonical file unchanged.

After downloading or replacing the canonical database, run from the repository
root:

```sh
pnpm --dir services/api build:cache
```

This command reads only the canonical database and runs no precompile stages.
Each component stores a SHA-256 generation over its canonical input inventory
hashes or payload bytes, the cache compiler version, and name-normalisation rules.
Search uses the area inventory; place search also uses named locations and the
boundary registry; projections use areas, named locations and crosswalks; counts
use the postcode and postcode-area inventories. Readers reject missing or stale
components with the command above. Unrelated observation updates do not invalidate
search. Compiler changes must increment `CACHE_VERSION` in `packages/atlas-runtime/src/storage/atlasCache.ts`.

Publish and download only `atlas.sqlite`. Never archive, release, or copy
`atlas-cache.sqlite` into an image or distribution. The source-data release script
already archives only `data/source`, and `.dockerignore` excludes all `data`.
Compose mounts the canonical file read-only inside a writable cache volume. The
container rebuilds its cache once before starting API workers. Outside Docker,
`data/build` must be writable by the account running the cache command.

The website continues to use its own data readers and never calls the API.

## Runtime files

| Files in `data/build/artifacts`               | Reader                                    | Why they remain                                                          |
| --------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------ |
| `data-catalog.json`                           | `catalogueManifestLoader.ts`              | Measure definitions and source references                                |
| `measure-compatibility.json`                  | `catalogueManifestLoader.ts`              | Supported measure and boundary combinations                              |
| `export-manifest.json`                        | `catalogueManifestLoader.ts`, bulk routes | Export metadata for observation artifacts                                |
| `lookup-manifest.json`                        | `catalogueManifestLoader.ts`              | Lookup catalogue metadata                                                |
| `map-resources.json`                          | `mapResourceLoader.ts`                    | Boundary tile resource metadata                                          |
| `geometry-sources.json`                       | `geometrySources.ts`                      | Source geometry lookup                                                   |
| `relationship-candidates.json`                | `governanceLoader.ts`                     | Candidate relationship governance                                        |
| `validation-report.json`                      | `catalogueManifestLoader.ts`              | Validation results                                                       |
| `operations.json`                             | `catalogueManifestLoader.ts`              | OpenAPI query parameter validation, checked against the current document |
| `atlas-release.json`                          | `catalogueManifestLoader.ts`              | Release identity and artifact hashes                                     |
| `evidence-documents.json`, `documents/*.json` | `catalogueLoader.ts`, document routes     | Evidence documents and their index                                       |

Atlas page and lookup manifests and their gzipped artifacts live under
`data/build/atlas-assets/`. The API readers `atlasPages.ts` and `atlasLookups.ts`
serve those files. The pipeline assembles the same bytes into `website_assets`
in `data/build/atlas.sqlite`, which the website reads directly.

Observation contracts are stored as rows in SQLite (`observations`,
`observation_series` and their dictionary and sparse tables, with one wide table
per shared census table), not as JSON text. `build-data-catalog.ts` compiles and
publishes them atomically; `observation_catalogue` links them to the data
catalogue hash. The API rebuilds each artifact's exact JSON from its rows and
checks it against the stored payload hash, so corruption is detected on read.
Measure views and rebuilt bulk JSON text share a 64 MiB LRU by default. Each
entry charges two bytes per text code unit plus the UTF-8 source byte allowance
for parsed data. This is cache accounting, not an exact JavaScript heap limit.
Oversized entries are served without retention; text-only reads do not parse JSON. Cached
views remember their observation generation and refuse to read a newer
generation until the API restarts. JSON exports return the rebuilt text and
verify its byte count. `observations_decoded` exposes ordinary series; `observations_census` unpivots
wide census tables, retaining zero and NULL cells and using NULL for status,
source area, category and confidence fields. `observations_all` combines the two
with identical columns. Per-table `observation_<table>_decoded` views stay wide.
Join the views' measure ids to `observation_measures` for labels, units,
aggregation rules and weights, concepts and uncertainty. Metadata absent from the
catalogue is NULL. Join `observation_series.datasetId` to
`observation_datasets.datasetId` for publisher, source URL, temporal coverage and licence.
These tables remain STRICT. An index on `observations (areaId, seriesId, periodId)`
supports queries across measures for one area.

Compatibility checks, analysis-geography validation, the validation report,
and JSON, CSV, and Parquet exports read those
same SQLite rows. JSON download contracts and their content hashes are
unchanged. Public observation JSON files are removed after successful publication.

Boundary geometry served to map clients is in PMTiles. Geometry source lookup
and geometry-store data still support server-side spatial processing.

## Build inputs retained after SQLite migration

The following JSON remains necessary to assemble the database or compile later
artifacts. Its presence does not imply a runtime JSON fallback.

| Build artifacts                       | Consumers                                                                              |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| Area inventory and `areas/`           | `areaTables` in `atlasAreas.ts`, loaded by `build-atlas-sqlite.ts`                     |
| Crosswalk inventory and `crosswalks/` | `crosswalkTables` in `atlasCrosswalks.ts`, loaded by `build-atlas-sqlite.ts`           |
| Named locations                       | `namedLocationTables` in `atlasNamedLocations.ts`, loaded by `build-atlas-sqlite.ts`   |
| `terrain-catalogue.json`              | Copied into SQLite payloads by `build-atlas-sqlite.ts`                                 |
| `data/build/datasets/`                | SQLite dataset payloads and website dataset compilation                                |
| `data/build/location-projections/`    | SQLite location projection tables                                                      |
| `data/build/geography/`               | `build-geography-catalogues.ts` stores the five geography catalogue payloads in SQLite |
| `source-data/`                        | Boundary and gazetteer inputs produced by `build-api-datasets.mts`                     |

Postcode search shards, postcode-to-area shards, and postcode counts have
SQLite readers. Their old public JSON files are obsolete, and their publishers
remove them after successful database publication. The postcode build stages
remain necessary because they now populate SQLite.

## Pipeline cleanup

`query-rules` generates committed TypeScript, not a data artifact. It is removed
from `data:build`; the API `build` and `typecheck` commands now generate it.
The explicit command is `pnpm --dir services/api generate:query-rules`.
The existing query rule test checks the generated values against OpenAPI.

The data-catalog stage remains necessary: it compiles the measure catalogue and
observation contracts, then stores the observations in SQLite. It no longer
publishes separate observation JSON files. Compatibility and export stages also
remain necessary because they compile distinct derived metadata and downloads.

To deploy this migration, run `pnpm data:build` before starting the servers.
A code build alone does not populate the new observation tables.

## Observation storage design

The publisher accepts `(artifact identity, exact text)` entries and requires one
entry for every artifact referenced by the catalogue. Shared census tables have
one entry even when several measures reference them. Duplicate, missing, and
unexpected entries fail before publication.

The publisher rebuilds every artifact from its rows and compares the exact text
before committing. This preserves field order, optional publisher codes,
categorical values, confidence intervals and table nulls. Any byte difference
aborts publication. No JSON payload copy is stored.

Publication uses transactions in a unique temporary database and an atomic
rename. Replacement drops only fixed owned objects and wide tables and decoded
views named by the previous `observation_tables.valueTable` registry. Unrelated
`observation*` objects survive. The store step explicitly recreates its
`observation_catalogue` marker, then runs `ANALYZE` before `VACUUM`. Readers open short-lived read-only connections and compare the published
generation with the one held by their cache. They reject replacement data rather
than serving it under an older catalogue. This keeps connection lifetime outside
the route and server interfaces. Data builds remain sequential, as other atlas
SQLite publishers also replace the shared file.
