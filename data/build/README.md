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
| `meta`     | `value`       | `TEXT NOT NULL`        | Database schema version, currently `"1"`.                                        |
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
`Cache-Control: public, max-age=31536000, immutable`. The route supplies gzip
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
properties for area sizes. `scripts/copy-atlas-data.mts` copies only compiled
atlas lookups and pages, so it needs no area-inventory copy.

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
Atlas lookups and pages use the migrated loader. The website copy step still
copies their generated outputs and never reads crosswalk JSON directly.

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
longer reads them. Atlas pages use the resolver's migrated loader. The website
copy step copies only generated atlas lookups and pages.

### Location projections

`location_projection_members` and `location_projection_parents` have composite
primary keys `(crosswalkId, key)`, both non-null text, and non-null `value BLOB`.
Each row stores one JSON projection compressed with its shard's dictionary.
`location_projection_dictionaries` has composite primary key `(kind, crosswalkId)`
and non-null `dictionary BLOB`. All three tables use `WITHOUT ROWID`.

The `location-projection-inventory` payload preserves the inventory's exact JSON
bytes and provenance hashes. Runtime inventory and projection reads use only
`atlas.sqlite`. Lookups still decompress one projection at a time and cache only
shard dictionaries. The shared writer replaces the database atomically, then
removes the obsolete `services/api/public/location-projections.sqlite`.

The `location-projections` stage writes JSON shards and their inventory under
`data/build/location-projections/` for the shared SQLite writer. They are omitted
from the current-build manifest and removed from the API public directory. Rebuilding projections invalidates the
shared database and its downstream consumers.

Run `node --import tsx scripts/verify-location-projections.mts` after building to
compare every stored member and parent projection with its release shard.

## Planned

Other ready-to-send payloads will follow in `atlas.sqlite`.
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
resumable build state. The API reads these assets directly. The website copies
its archives and `tiles.json` to `public/data/boundaries/` during data and app
builds, preserving static URLs. Publish API map assets from
`data/build/map-resources/`, keeping the `map-resources/` URL prefix.
