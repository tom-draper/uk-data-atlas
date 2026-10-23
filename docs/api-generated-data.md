# Generated API data

This audit follows the postcode search, area mapping, and count migrations to
`data/build/atlas.sqlite`. It describes consumers in the source, rather than
assuming that every file left by an older local build is still required.

## Runtime files

| Files in `services/api/public`                  | Reader                                         | Why they remain                                                          |
| ----------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------ |
| `data-catalog.json`                             | `catalogueManifestLoader.ts`                   | Measure definitions and source references                                |
| `*-observations.json`, `*-table.json`           | `observationLoader.ts`, `observationTables.ts` | Lazy observation loading, including tables shared by several measures    |
| `measure-compatibility.json`                    | `catalogueManifestLoader.ts`                   | Supported measure and boundary combinations                              |
| `export-manifest.json`                          | `catalogueManifestLoader.ts`, bulk routes      | Export metadata for observation artifacts                                |
| `lookup-manifest.json`                          | `catalogueManifestLoader.ts`                   | Lookup catalogue metadata                                                |
| `map-resources.json`                            | `mapResourceLoader.ts`                         | Boundary tile resource metadata                                          |
| `geometry-sources.json`                         | `geometrySources.ts`                           | Source geometry lookup                                                   |
| `relationship-candidates.json`                  | `governanceLoader.ts`                          | Candidate relationship governance                                        |
| `validation-report.json`                        | `catalogueManifestLoader.ts`                   | Validation results                                                       |
| `operations.json`                               | `catalogueManifestLoader.ts`                   | OpenAPI query parameter validation, checked against the current document |
| `atlas-release.json`                            | `catalogueManifestLoader.ts`                   | Release identity and artifact hashes                                     |
| `evidence-documents.json`, `documents/*.json`   | `catalogueLoader.ts`, document routes          | Evidence documents and their index                                       |
| `atlas-lookups.json`, `atlas-lookups/*.json.gz` | `atlasLookups.ts`, website copy stage          | Published lookup downloads                                               |
| `atlas-pages.json`, `atlas-pages/*.json.gz`     | `atlasPages.ts`, website copy stage            | Published place page data                                                |

Observation files are derived from the compiled datasets also held in SQLite,
but they are not interchangeable copies. `build-data-catalog.ts` compiles API
observation contracts, and the API reads those contracts on demand.
Removing this output requires migrating observation loading, compatibility
validation, and exports together.

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

No remaining JSON-producing data stage above can be deleted without replacing
an active consumer. A useful next migration is the catalogue and observation
contract group, including compatibility and export compilation. Moving only
its manifest would leave the bulk of the files and their build work intact.

This audit does not delete generated local data or run a full data rebuild.
