# data/build/

Data compiled once from the raw sources in `data/source/`, for both the website and the
API. Raw-source downloads restore `data/source/` and leave this folder intact. Everything here is generated, and only this README is tracked. Rebuild it
with `pnpm data:build` (see "One data build" in `ARCHITECTURE.md`).

```text
data/source/          raw sources, restored from the pinned data release
  │
  ▼  pnpm data:build --only datasets
data/build/
  datasets/
    dataset-manifest.json     one entry per catalogue dataset
    <output>.json             one compiled payload per entry
  │
  └──▶ atlas.sqlite
         ├──▶ API server
         └──▶ Next.js server ──▶ hash-versioned JSON ──▶ browser
```

Neither product writes here. The data pipeline writes this release. Both servers
read catalogue datasets from `data/build/atlas.sqlite` on disk. The browser reads
JSON from the Next.js server and never opens SQLite or fetches from the API.

## datasets/

`dataset-manifest.json` is `{ "version": 1, "datasets": [...] }`, with one entry
per dataset in `CATALOGUE_DATASET_DEFINITIONS`, in catalogue order.

| Field         | Meaning                                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `type`        | The dataset's id in the catalogue, e.g. `claimantCount`.                                                                    |
| `output`      | Its payload file, `<output>.json` beside the manifest.                                                                      |
| `source`      | Where the data comes from and its licence, from the definition.                                                             |
| `contract`    | The ingestion contract the source was checked against.                                                                      |
| `inputs[]`    | Each raw file read: `kind`, `path` under `data/source/`, `bytes`, `sha256`, and the file's size and mtime when it was read. |
| `summary`     | `datasetCount`, `dataRecordCount` and `boundaryYears`, from validation.                                                     |
| `compiled`    | The payload's `bytes` and `sha256`, and its mtime when written.                                                             |
| `fingerprint` | A hash of the code that compiled it.                                                                                        |

A payload is the dataset's compiled records, keyed by dataset id, with dense
number maps stored as arrays (`@uk-data-atlas/catalogue/compactPayload`).

A later run reuses a payload when its `fingerprint` is unchanged, every input
still has the recorded size and mtime (or belongs to the pinned data release),
and the payload still matches `compiled`. Otherwise the dataset is compiled
again. `pnpm data:build --only datasets` builds this stage and its prerequisites.

## atlas-cache.sqlite

This local API cache is never distributed. Search indexes, location projections
and postcode counts live here. After replacing `atlas.sqlite`, regenerate it with
`pnpm --dir services/api build:cache` from the repository root. This reads only
the canonical database, without precompile. Missing or stale components fail with
that command. See [generated API data](../../docs/api-generated-data.md).

## atlas.sqlite

The `atlas-sqlite` stage depends on `terrain-catalogue`, `datasets`, `area-inventory`, `crosswalk-inventory`, `named-locations`, and `location-projections` and writes this database
with the existing `node:sqlite` library. It replaces the whole database through
a temporary file and atomic rename. Every run writes the base tables. The stage cache requires the database file
to exist even after the catalogue stage takes ownership of its current bytes.
The later `geography-catalogues` stage stores geography catalogue payloads after
analysis compilation. It updates a temporary copy and atomically replaces the
database, retaining the existing tables. Its temporary copy is removed after a
failure. Run the complete API or website target to include both stages.

The database contains these tables:

| Table      | Column        | Type                   | Key and meaning                                                                  |
| ---------- | ------------- | ---------------------- | -------------------------------------------------------------------------------- |
| `meta`     | `key`         | `TEXT`                 | Primary key. Currently only `schemaVersion`.                                     |
| `meta`     | `value`       | `TEXT NOT NULL`        | Database schema version, currently `"3"`.                                        |
| `payloads` | `id`          | `TEXT NOT NULL`        | Primary key. `terrain-catalogue`, `dataset-manifest`, or `dataset:<output>`.     |
| `payloads` | `payload`     | `TEXT NOT NULL`        | Exact UTF-8 JSON text from its compiled input, preserving bytes and array order. |
| `datasets` | `type`        | `TEXT NOT NULL`        | Primary key. Catalogue dataset type.                                             |
| `datasets` | `output`      | `TEXT NOT NULL UNIQUE` | Compiled output name, without `.json`.                                           |
| `datasets` | `source`      | `TEXT NOT NULL`        | JSON source metadata from the manifest.                                          |
| `datasets` | `contract`    | `TEXT NOT NULL`        | JSON dataset contract.                                                           |
| `datasets` | `summary`     | `TEXT NOT NULL`        | JSON compilation summary.                                                        |
| `datasets` | `fingerprint` | `TEXT NOT NULL`        | Dataset compiler and input fingerprint.                                          |
| `datasets` | `sha256`      | `TEXT NOT NULL`        | SHA-256 of the exact uncompressed payload bytes.                                 |
| `datasets` | `bytes`       | `INTEGER NOT NULL`     | Uncompressed UTF-8 payload length.                                               |
| `datasets` | `payloadId`   | `TEXT NOT NULL`        | Foreign key to `payloads.id`, `dataset:<output>`.                                |

`meta`, `payloads`, `datasets`, `area_releases`, `areas`, `crosswalks`, `crosswalk_sources`,
`crosswalk_targets`, `crosswalk_coverage`, `named_locations`, `named_location_members`,
`named_location_assertions`, `named_location_partial_members`, and `named_location_geometries` use `WITHOUT ROWID`. Each dataset has one payload. The complete
manifest is also retained as a payload to preserve its version, input provenance
and ordering. Reusing `payloads` keeps ready-to-send JSON in one table alongside
the terrain catalogue. The writer validates every dataset's hash and length.
SQLite enforces the payload foreign key during the build.

The atomic writer rebuilds all tables, reading one dataset at a time. It avoids
retaining all payloads in memory. Incremental row updates would require copying
the database before mutation to retain atomic publication, so they are deferred.
The stage cache skips the whole write when inputs are unchanged.

`readTerrainCatalogue(apiRoot)` opens `../../data/build/atlas.sqlite` relative to
the API root in read-only mode, reads the `terrain-catalogue` row, validates its
schema version and products array, then closes the connection. It does not fall
back to JSON. Keep `data/build/atlas.sqlite` under the repository root when
deploying the API.
The `documents` stage depends on `atlas-sqlite` because it loads API catalogues.

`services/api/public/terrain-catalogue.json` remains a build intermediate for
the shared SQLite writer. The API terrain loader
no longer reads it. The API catalogue compiler, API atlas pages and website SEO compilers read
dataset payloads from SQLite.
Gazetteer core and boundary assets remain API build intermediates under
`services/api/public/source-data/`. Legacy provenance artifact labels in API
responses remain unchanged for byte compatibility.

The Next.js atlas pages pass a map of output names to hash-versioned URLs into
the client. `GET /data/catalogue/<sha256>/<output>.json` joins `datasets.payloadId`
to `payloads.id`, matching both output and hash before returning the exact JSON
with `Content-Type: application/json; charset=utf-8` and
`Cache-Control: public, max-age=31536000, immutable`. Fuel poverty instead
reconstructs these same bytes from statistics rows after matching the
output and hash in `datasets`. The route supplies gzip
compression when the client accepts it, with `Vary: Accept-Encoding`. Missing outputs and stale or invalid
hashes return 404 with `Cache-Control: no-store`, never a different payload at
an old URL. A database deployment can therefore invalidate uncached old URLs;
pages and the compiled release must deploy together.

The website data build still reads `data/build/datasets/` to cut regional chunks. It
does not copy catalogue payloads into `public/data/datasets/`. That directory
still holds generated gazetteer, road-safety, regional chunk and SEO assets,
plus the website build manifest. The graph compiles shared datasets and SQLite
before running the website compilation stage. `pnpm data:build --from datasets`
rebuilds shared datasets, SQLite and their downstream consumers. `pnpm data:verify --target website` checks the website manifest and assets,
including catalogue payload hashes in SQLite. It does not validate the relational
API tables or the complete compiled release.

### Statistics tables

`atlas-sqlite` writes the canonical statistics tables from
`docs/sqlite-schema-design.md` (layer 4, migration step 1). Only fuel poverty
uses them so far. They are separate from the API's `observations` and
`observation_*` tables, which `data-catalog` populates and step 4 retires.
The base database schema version is 3; the `catalogue_*` pilot tables from PR #398
are gone.

All tables are `STRICT` with integer keys. Writer: `shared/atlasStatistics.ts`.

| Table               | Key                                       | Meaning                                                                                        |
| ------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `source`            | `id`                                      | Publisher, URL and licence.                                                                    |
| `dataset`           | `id`, `slug` unique                       | Title, description, `source_id`, compiler `fingerprint`. `slug` is the compiled output name.   |
| `measure`           | `id`, `slug` unique                       | Shared across datasets. Unit, `value_kind`, `aggregation`, and numerator/denominator measures. |
| `dimension`         | `id`, `slug` unique                       | A breakdown such as `tenure` or `crime-type`.                                                  |
| `dimension_member`  | `id`, unique `(dimension_id, code)`       | Member label, optional parent, publisher `position`.                                           |
| `period`            | `id`, `label` unique                      | `kind`, `start_date`, `end_date`.                                                              |
| `status`            | `id`, `slug` unique                       | `observed` (1), `estimated`, `provisional`, `suppressed`, `not_applicable`.                    |
| `series`            | `id`, `key` unique                        | One dataset, measure, release (`area_releases.position`) and set of members, plus `method`.    |
| `series_member`     | `(series_id, dimension_id)`               | The members fixing a series. Indexed by `(member_id, series_id)`.                              |
| `observation`       | `(series_id, area_version_id, period_id)` | `value`, `status_id`, optional `lower`, `upper`, `category_id`. `WITHOUT ROWID`.               |
| `dataset_area_name` | `(dataset_id, area_version_id)`           | A publisher's area name, stored only where it differs from `areas.name`.                       |

`observation.area_version_id` references `areas(id)`, one row per release and
code. `observation` is indexed by `(area_version_id, series_id, period_id)` for
place queries. The build fails if an observation's area is not in its series'
release, if an observed value is null, or if a dataset's `verify` hook fails.
`v_observation` joins everything into readable rows (dataset, measure, unit,
members, area code and name, geography, release, period, value, status,
method, licence).

Fuel poverty (`shared/fuelPovertyStatistics.ts`) maps each record field to a
measure (`households`, `fuel-poor-households`, `fuel-poverty-rate`) on the 2021
LSOA release. Record order is area code order and is not stored; the mapper
refuses unordered input. The period header (`id`, `year`, `boundaryType`,
`boundaryYear`) is derived from the period and release. Its JSON payload stays
in `payloads` until step 4. `GET /data/catalogue/<sha256>/fuel-poverty.json`
rebuilds the bytes from rows after matching the hash in `datasets`, and the
build refuses to publish if the rebuilt bytes differ from the payload. Rebuild
older databases with `pnpm data:build --only atlas-sqlite` before deploying the
new reader.

Run `pnpm exec vitest run --project built tests/built/atlasStatistics.test.ts`
to compile the real fuel poverty payload and LSOA inventory, build an isolated
database through `buildAtlasSqlite`, and compare every byte. Other inventories
are empty fixtures. `data/build/statistics-pilot.json` records database bytes
with and without the statistics tables after vacuuming, and the size of the
area index. This measures the statistics tables, not a full release.

### Areas

`area_inventory` has one row keyed by integer `position = 0`, with
`schemaVersion INTEGER`, `contentHash TEXT`, and `boundaryRegistryHash TEXT`, all
non-null. `area_releases` has the composite primary key `(geography, id)` and
unique integer `position` to preserve inventory order. Its non-null text columns
are `geography`, `id`, and `status`. Available releases have `recordCount INTEGER`,
`artifact TEXT`, `contentHash TEXT`, `codeProperty TEXT`, and `nameProperty TEXT`.
`derivedFrom TEXT` holds optional JSON source-adapter metadata. Unavailable
releases have `reason TEXT` instead. Inapplicable columns are null.

`areas` has primary key `(geography, boundaryRelease, code)`, non-null text
`name`, and non-null integer `position` for record order. Nullable `aliases TEXT`
holds an ordered JSON string array, preserving absent versus empty aliases.
Its `(geography, boundaryRelease)` foreign key references `area_releases`.
An index on `(geography, boundaryRelease, position)` supports ordered release
reads. The primary key supports area-code lookups within a release.

The API inventory and bounded lazy area lookup read these tables in read-only
connections that close after each read. They refuse stale hashes and incomplete
releases and never fall back to JSON. SQLite runs before the
place-index, area-search-index, postcode-area, and atlas-lookup consumers.

The area inventory and `areas/*.json` remain build intermediates. Geometry
registry, crosswalk compilation, named-location compilation, compatibility, lookup manifest, validation,
geography inventory, location projections, relationship candidates, docs catalogue,
map resources, proposals, benchmarks
still read them. Atlas lookups use the migrated loader. Atlas pages read boundary
properties for area sizes. Producers write the manifests and gzip files under
`data/build/atlas-assets/`. The `pipeline/` workspace owns the `website-lookups`
stage, which validates and stores those release files in the `website_assets`
table before the final release
manifest hashes the database. Its primary key is `(kind, id)`, where `kind` is
`pages` or `lookups`. Each row stores a SHA-256 hash and the original gzipped
JSON bytes. Website routes serve those bytes directly to gzip-capable clients;
server rendering and precompilation decompress the selected row. Old public
copies are removed only after a validated import succeeds. Next.js builds only
read these rows. API page and lookup routes read the gzip files under
`atlas-assets/`, so include that directory alongside SQLite in API deployments.
Other API build outputs remain under `services/api/public/` during the compiler
migration. See `docs/data-pipeline-move.md` for the remaining work.

### Crosswalks

`crosswalk_inventory` has one row keyed by integer `position = 0` with non-null
`schemaVersion INTEGER` and `contentHash TEXT`. Nullable `areaInventoryHash TEXT`
records whether release coverage is present. `crosswalk_coverage` has primary
key `(geography, boundaryRelease)`, both non-null text, unique non-null integer
`position`, and non-null integers `areaCount` and `relatedAreaCount`.
Its rows retain coverage order and refer to the inventory hash, without requiring
all historical crosswalk endpoints to exist in `areas`.

`crosswalks` has text primary key `id`, unique integer `position`, text
`fromGeography`, `fromRelease`, `toGeography`, `toRelease`, `method`, `quality`,
`weighting`, `artifact`, `contentHash`, and `header`, plus integer `recordCount`
and `bytes`. These columns are non-null. Nullable `relationshipPurpose TEXT`
distinguishes identity and membership where declared. `weighting` is JSON.
`header` is the artifact metadata with a null `records` placeholder, preserving nested provenance,
validation and property order. `bytes` retains the original JSON byte count for
the existing cache budget. An index on `(fromGeography, fromRelease, toGeography,
toRelease)` supports endpoint selection.

`crosswalk_sources` has primary key `(crosswalkId, position)`, with a foreign key
to `crosswalks.id`. `crosswalk_targets` has primary key `(crosswalkId,
sourcePosition, position)` and a foreign key `(crosswalkId, sourcePosition)` to
`crosswalk_sources`. Identity columns are non-null text for `crosswalkId` and
non-null integers for positions. Each table has non-null text `code`, `labels`,
and `fields`. `labels` is an ordered JSON string array. `fields` is an ordered
JSON list of present property names, preserving property order and absent versus
null values when reconstructing responses. Endpoint values live in columns,
not in record payload blobs.

Nullable source `REAL` columns are `areaM2`, `coverage`, and `population`.
Nullable target `REAL` columns are `weight`, `overlapAreaM2`, `sourceShare`,
`targetShare`, `population`, `containedShare`, `outsideWidthM`,
`widestDifferenceM`, and `claimedDifferenceM`. Nullable target text columns are
`change`, `match`, and `relation`. Missing weights stay null, distinct from zero.
Both endpoint tables index `(crosswalkId, code)` for forward and reverse code
lookups. Their primary keys support the API's ordered artifact reads.

The API crosswalk inventory and bounded lazy artifact loader read SQLite and
close each connection after a read. JSON inventories and compressed crosswalk
artifacts remain inputs to relationship paths, analysis geographies and their
validation, location projections, relationship candidates, geography inventory,
lookup manifests, validation reports, proposals.
Atlas lookups and pages use the migrated loader. Their compilers write to
`data/build/atlas-assets/`, and the pipeline assembles those files into SQLite.
The website never reads crosswalk JSON directly.

### Named locations

`named_location_inventory` has one row keyed by integer `position = 0`. Its
non-null columns are `schemaVersion INTEGER`, `contentHash TEXT`, `artifact TEXT`
and `gazetteerVersion INTEGER`. The last two describe the source gazetteer.

`named_locations` has text primary key `id`, unique integer `position`, text
`fields`, `label`, `kind`, and `memberGeography`, integer `definitionRevision`,
and real `minX`, `minY`, `maxX`, `maxY`. These columns are non-null. Nullable text
`validFrom` and `validTo` retain the definition's half-open validity interval.
Nullable `source TEXT` contains the publisher-specific provenance object as JSON.
`fields` is an ordered JSON list of property names. It preserves optional arrays,
including absent versus empty arrays, and response property order. Indexes on
`(kind, position)` and `(memberGeography, position)` support filtered inventories.

Membership data lives in relational child tables. Each has non-null
`locationId TEXT`, a foreign key to `named_locations.id`, and non-null
`position INTEGER`, with composite primary key `(locationId, position)`.

- `named_location_members` has non-null `code TEXT`, preserving declared member order.
- `named_location_assertions` has non-null `code TEXT` and nullable text
  `validFrom`, `validTo` for each dated membership assertion. An index on
  `(locationId, code, validFrom, validTo)` supports dated membership lookups.
- `named_location_partial_members` has non-null `code TEXT`, `share REAL`, and
  `memberOf TEXT`. Zero shares remain zero.

Members and partial members index `(code, locationId)` for reverse membership
lookups. Codes refer to the parent's `memberGeography`. They have no foreign key
to `areas`, because assertions can describe historical codes across releases.
`memberOf` is a foreign key to the named location holding that partial member.

`named_location_geometries` has text primary key `locationId`, a foreign key to
`named_locations.id`, non-null `boundaryRelease TEXT`, real `minX`, `minY`,
`maxX`, `maxY`, and `geometry TEXT`. The last column contains GeoJSON. Geometry
is optional, one row per location with a compiled union. Its release belongs to
the parent's `memberGeography`. The API loads geometry on first access and
closes every SQLite connection after reading. Inventory and membership reads do
not parse geometry.

The named-location compiler reads area JSON intermediates before SQLite is
built, avoiding a dependency cycle. The API inventory loader and place-index
compiler read named locations from SQLite. Full named-location JSON remains for
location projections, lookup exports. Packed metadata and
geometry JSON remain build outputs of the same compiler, although the API no
longer reads them. Atlas pages use the resolver's migrated loader and write
release artifacts that the pipeline stores in `website_assets`.

### Location projections

`location_projection_members` and `location_projection_parents` have composite
primary keys `(crosswalkId, key)`, both non-null text, and non-null `value BLOB`.
Each row stores one JSON projection compressed with its shard's dictionary.
`location_projection_dictionaries` has composite primary key `(kind, crosswalkId)`
and non-null `dictionary BLOB`. All three tables use `WITHOUT ROWID`.

The cache `location-projection-inventory` payload preserves the inventory fields
and provenance hashes. Runtime inventory and projection reads use only
`atlas-cache.sqlite`. Lookups still decompress one projection at a time and cache only
shard dictionaries. The shared writer replaces the database atomically, then
removes the obsolete `services/api/public/location-projections.sqlite`.

The `location-projections` stage writes JSON shards and their inventory under
`data/build/location-projections/` for the shared SQLite writer. They are omitted
from the current-build manifest and removed from the API public directory. Rebuilding canonical projection inputs invalidates the local projection cache.

Run `node --import tsx scripts/verify-location-projections.mts` after building to
compare every stored member and parent projection with its release shard.

## Planned

Other API accelerators belong in `atlas-cache.sqlite`.
`tiles/*.pmtiles` will hold boundaries.

## geography/

Compiler intermediates for boundary releases, geography inventory, relationship
paths, analysis geographies and analysis validation live here. The
`geography-catalogues` stage stores their exact JSON bytes in `payloads`, keyed
by filename without `.json`. The API reads SQLite only. Two evidence document
endpoints also serve these stored bytes, preserving their hashes and ETags.

Run `pnpm data:build --only geography-catalogues` to build this group and its
prerequisites. Run `node --import tsx scripts/verify-geography-catalogues.mts`
to compare every payload with its compiler intermediate byte for byte.

Boundary tiles are built in `data/build/boundaries/` for the website and
`data/build/map-resources/` for the API, alongside its feature downloads and
resumable build state. The API reads these assets directly. The website hard-links
its archives into `public/data/boundaries/` during data and app builds, preserving
static URLs with one stored copy. Both directories must share a filesystem.
Every website release has an archive. Releases rejected by shared-arc
compilation use the polygons previously drawn from the compiled topology, with
no further generalisation. This is restricted to ward 2017 and LSOA 2001 with their expected counts of over-shared edges. The manifest records this method and its reason;
the API's strict coverage policy is unchanged.

Website TopoJSON and its properties intermediates live in
`data/build/website-boundaries/`. Gazetteer and matching builds read that private
directory. Only PMTiles, properties sidecars, and the manifest are published to
`public/data/boundaries/`; regional topology chunks are no longer built.

Only the small `tiles.json` manifest is copied. See `deploy/README.md` for
transferring a built tree without duplicating the archives. Publish API map assets from
`data/build/map-resources/`, keeping the `map-resources/` URL prefix.

### Place search

`place_index_meta`, `place_index_places`, `place_index_names` and
`place_index_codes` store the place search index in `atlas-cache.sqlite`. Places,
names and codes retain their sorted integer positions, so the resolver reads
only the rows touched by its existing binary search. Labels and code references
retain their packed representation. Metadata records normalization rules and
upstream area and named-location hashes, which readers validate before use.

The `place-index` stage runs after the base database and geography catalogues.
It replaces only its own tables in a temporary copy of the local cache and
publishes it atomically, preserving other cache components. Successful builds remove
`services/api/public/place-index.sqlite` and both old JSON variants. No source
release changes are needed. Rebuild with `pnpm data:build --only place-index`.

Run `node --import tsx scripts/verify-place-index.mts` to compare every place,
name, label and code with freshly compiled inputs and check representative
search results.

### Area search

`area_search_meta`, `area_search_codes`, `area_search_terms` and
`area_search_title_terms` store area search in `atlas-cache.sqlite`. Codes keep their
release order and terms keep their packed postings. Search still reads only the
rows needed for matching, filters and pagination.

The `area-search-index` stage replaces its tables in a temporary copy of the
local cache and publishes it atomically, retaining other cache components. Successful builds remove the separate database and both old JSON
variants from `services/api/public/`. The cache is excluded from the build manifest and distribution.

Rebuild with `pnpm data:build --only area-search-index`. Run
`node --import tsx scripts/verify-area-search-index.mts` to compare every stored
code, term and posting with freshly compiled inputs, along with filtered search
pages and exact matches. No source release changes are needed.

### Postcode search

`postcodes` holds one relational row per unit postcode. Its primary key is
`postcode`, with no separate postcode autoindex or stored district position. Columns
hold the grid coordinates, quality indicator, country, introduction and termination
months, and large-user flag. Missing coordinates stay null, and a zero termination
month denotes a live postcode. The table uses `WITHOUT ROWID`.

The `postcode-index` payload stores source attribution, counts, exclusions and
original district hashes. The runtime reconstructs and verifies one district at a
time and retains its existing bounded cache. Stable district ordering preserves
postcode-to-area positional joins. The postcode count builder also reads SQLite.

The `postcode-index` stage runs after the base atlas database, replaces only its
own table and payload in a temporary copy, then publishes atomically. It removes
`services/api/public/postcode-index.json` and the old `postcodes/` district files
after success. Postcode areas remain in `atlas.sqlite`. Postcode counts have a separate build stage
and live in `atlas-cache.sqlite`.

Rebuild with `pnpm data:build --only postcode-index`. Run
`node --import tsx scripts/verify-postcode-index.mts` to verify every postcode,
district hash and row count, and sample district positions. A full `pnpm data:build`
refreshes downstream postcode-area and count outputs too. Running only the
postcode-index stage removes the area columns, so rebuild postcode-areas afterward,
even when the postcode content hash is unchanged. No new source release is needed.

### Postcode areas

The `postcode-areas` stage stores integer area references on `postcodes`. Each compiled release has an
`AreaId` column referencing `areas(id)` and a `DistanceCm` column. A geography
with one release uses names such as `countryAreaId`. Multiple releases use
release-qualified names such as `"localAuthority_2026-05-uk-bgcAreaId"`.
`postcode_area_releases` lists each geography, boundary release and column name.
All IDs refer to that exact boundary release. Missing inventory areas are added
to `areas` with `inInventory=0` and an empty name, since shard inputs contain codes
but no labels.

```sql
SELECT p.postcode, a.code, a.name
FROM postcodes p JOIN areas a ON a.id = p.countryAreaId
WHERE p.postcode = 'SW1A1AA';

SELECT postcode, countryCode FROM postcodes_decoded
WHERE postcode = 'SW1A1AA';

SELECT geography, boundaryRelease, areaColumn, distanceColumn
FROM postcode_area_releases;
```

A null area ID means no single interior match. `postcode_area_matches` holds
multiple or boundary matches, with their containment, distance and original order.
Its decoded view, `postcode_area_matches_decoded`, adds geography, boundary
release, code and name. `postcode_area_columns` preserves release order and the
presence of the optional several-match field per district. `postcode_area_codes`
preserves each district's code dictionary as ordered references to `areas`.
These small tables retain the details needed to reconstruct the original bytes.

The reader selects a compact-postcode prefix range, filters to the district's
postcode length, and orders by postcode using the primary key. This reproduces
the compiler's code-unit order, including districts such as M1, M10 and M1A.
It reconstructs the original district JSON and verifies the manifest SHA-256
before returning it. Postcode and area content hashes and API ETags are unchanged.

Build this schema through the normal atlas and postcode build stages. The
postcode-area writer checks every reconstructed area shard before publishing its
temporary database atomically. Rebuild older databases with the current builders;
the runtime supports only the normalized schema.

Compare an old database with the rebuilt database using
`NODE_OPTIONS=--max-old-space-size=2560 npx tsx services/api/scripts/compare-postcode-sqlite.ts BEFORE.sqlite services/api services/api/benchmarks/sqlite-postcode-areas.json`.
The check requires nonempty shard inventories and exits nonzero on any byte or
hash mismatch. It reports both shard counts, mismatch counts, database bytes,
`dbstat` bytes per object, and nine warm timing samples for the largest area
shard and a direct postcode lookup. Each timed read opens its own connection.
