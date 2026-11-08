# data/build/

Data compiled once from the raw sources in `data/source/`, for both the website and the
API. Raw-source downloads restore `data/source/` and leave this folder intact. Everything here is generated, and only this README is tracked. Rebuild it
with `pnpm data:build` (see "One data build" in `ARCHITECTURE.md`).
The stage cache in `.cache/data-build/` records recent stage timings and the latest
build summary. Run `pnpm data:build --plan` to see available timing estimates and
which stages can run in parallel. A build where nothing changed runs no stage.
The `.stamps/` folder here holds one small file for each stage that adds tables
to `atlas-cache.sqlite`. It records the hash of that stage's tables, which is
how the cache tracks work inside a shared file. Delete a stamp to rebuild its
stage. The parity check stages (`verify-dataset-payloads`, `verify-postcode-areas`)
leave a stamp there too, as the record that they passed; a local build skips them
unless given `--verify`, and `pnpm data:verify` runs them.

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
| `type`        | The dataset's id in the catalogue, e.g. `claimant-count`.                                                                   |
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

The pipeline builds this cache alongside `atlas.sqlite`.
It contains search indexes, location projections, postcode counts and
`dataset_payload` for datasets served from rows. Each `dataset_payload` row
is keyed by `output` and holds `source_sha256` (the `dataset_catalogue.sha256` it was
built for), `sha256` and `bytes` (the hash and size of the JSON, which form the
website URL) and `gzip`, the JSON compressed at level 9 with a zero mtime and no
file name, so one build always stores the same bytes. Brotli is not stored: it
saved 30% over gzip only at quality 11, which took minutes per build. Readers
that need the text, such as the API, gunzip the row. The cache is stamped with the
SHA-256 hash of the final canonical database. The API opens both files read-only
and fails readiness if the cache is missing, stale, lacks required payloads or
predates the gzip column.
`verify-dataset-payloads` reads these rows back and compares each with the
compiler's JSON by value, so the build computes the generated payload once.
The stages that fill it (`place-index`, `area-search-index`, `postcode-counts`,
then `atlas-cache-stamp`) are skipped when unchanged. Each leaves a stamp in
`.stamps/`, and `atlas-sqlite` clears them all when it extends the cache.

A build copies the cache once for those stages. The first to write copies
`atlas-cache.sqlite` to `.atlas-cache.sqlite.work`, the rest change that copy,
and `atlas-cache-stamp` vacuums it once, with `VACUUM INTO` a temporary file
beside the cache, and renames that over the cache, so the published file is
replaced in one step at the end. If the build stops first, the
published cache is untouched. The next build discards the copy, with the stamps
of the stages that wrote to it, so they run again; it never resumes from the
copy, because a stage killed midway leaves pages that cannot be trusted. The
file only exists while a build runs. `atlas-sqlite` extends the cache in one
copy of its own, without a vacuum, and publishes it before the later stages
start, since stages between them read its projections. Stages run by hand (not
through `pnpm data:build`) publish their own change directly, with their own
copy and vacuum, as before.

### Vacuuming

A database is vacuumed once, when it is published, never by the stages that
write into it. `publishVacuumed(workPath, publishedPath)` in
`pipeline/src/storage/publishVacuumed.ts` runs `VACUUM INTO
'<published path>.tmp'`, syncs the file, renames it over the published path and
syncs the directory. A stale `.tmp` from a build that stopped is removed first,
and a failure leaves the published file as it was. `VACUUM INTO` writes the
compact file once, where an in-place `VACUUM` writes a temporary copy and then
the file again. On `atlas.sqlite` (1.19 GB) it took 58 to 82 seconds against 168
for the in-place form, and its output is byte for byte the same on every run.

- `atlas.sqlite`: `assemble-atlas` copies `atlas-base.sqlite`, adds the postcode
  and geography components, and publishes the copy with `publishVacuumed`.
  `atlas-base.sqlite` and `postcode-index.sqlite` are components and are not
  vacuumed. `website-assets.sqlite` is written in one pass and renamed, with
  nothing to reclaim.
- `atlas-cache.sqlite`: `atlas-cache-stamp` publishes the working copy with
  `publishVacuumed`. A stage run by hand publishes its own copy the same way.

The copy keeps the source's `page_size`, `auto_vacuum`, `user_version` and
`application_id`. It does not keep `journal_mode` (a WAL database comes out in
the default mode), and the writers use `journal_mode = OFF`, which is not stored
in the file. The stage cache is unaffected: stage digests hash the bytes of the
file a stage published, and the vacuum is deterministic, while the cache stages
are tracked by stamps that hash table content.
After restoring source data with `pnpm data:download`, run `pnpm data:build`
to build both files. Deploy them together from the same build. See
[generated API data](../../docs/api-generated-data.md).

## website-assets.sqlite

The website's precompressed pages and lookups live in this file, in the
`website_asset` table, and nowhere else. They are not in `atlas.sqlite`: only
the Next.js website reads them, so the file the API serves, and the one that
can be distributed as a data product, carries no website content. The
`website-lookups` stage writes the file by temporary copy and rename. No other
stage reads it and no API stage waits for it, so rebuilding the pages
invalidates neither `atlas.sqlite` nor `atlas-cache.sqlite`.

It is a file of its own rather than part of `atlas-cache.sqlite` because the
cache is stamped against the canonical database and the API refuses to start on
a stale one, and because several stages rewrite the cache by copy and rename.
The assets are written by one stage, are not derived from `atlas.sqlite`, and
have no reason to share either rule. Deploy the file with the Next.js server.
`readAtlasAsset` fails with the build command if it is missing, and the API
never opens it. The deprecated `website_assets` view is in this file.

## What `atlas.sqlite` keeps

`atlas.sqlite` holds the data the API serves, so a table is kept there if any
API route reads it. Two tables that look like build output are read at request
time and stay:

- `crosswalk_edge_check` holds the per-edge measures of a crosswalk (`match`,
  `widest_difference_m`, `contained_share`, `overlap_area_m2` and others).
  `readSqliteCrosswalk` joins it to rebuild each crosswalk's records, so
  `/v1/crosswalks/{id}/records`, `:convert`, the area overlap routes and the
  boundary release comparison (which reads `match === "recoded"`) all return
  its values.
- `payloads` holds `relationship-paths`, `geography-inventory`,
  `boundary-releases`, `analysis-geographies`, `analysis-geography-validation`,
  `terrain-catalogue`, `postcode-index` and `postcode-areas`, which the API
  loads, with `dataset-manifest` and any dataset payload stored whole, which
  only the website and checks read. `dataset_catalogue.payload_id` refers to the
  table, so those few kilobytes stay with it.

Readers of a file that is optional, such as `website-assets.sqlite`, check that
it exists and fail with the command that builds it.

## Read-only connections

Readers share one read-only `DatabaseSync` per database file per process, with
prepared statements kept per SQL string
(`packages/atlas-runtime/src/storage/readOnlyDatabase.ts`). Opening a
connection costs far more than a point query, mostly in opening the file and
parsing the schema. A reader leases the connection with
`openReadOnlyDatabase(path)` and calls `release()` in a `finally`.

The pipeline replaces `atlas.sqlite` and `atlas-cache.sqlite` by renaming a
temporary or working file over them, and a connection keeps reading the old inode. So
before a lease is handed out the file's `dev`, `ino`, `size` and `mtime` are
compared with those recorded at open (one `stat`, under a microsecond). A
changed file closes the connection, drops its statements and opens the new
file under a new generation. The check runs at most once per second, set with
`ATLAS_SQLITE_RECHECK_MS` (`0` checks every read). A connection replaced while
leased is closed when its last lease is released.

What derives from a file's contents is tied to its generation:
`requireAtlasCache` checks the cache's stored generation against
`atlas.sqlite` again after either file is replaced, `ObservationCache` drops
the artifacts it read, and the postcode page reader drops the releases and
layout it read. `memoByGeneration` and `onDatabaseReplaced` do the same for new
caches. A `SqliteIndex` keeps its lease for its life, so it stays on the
release it was validated against. The API reads catalogues once at start, so a
replaced file is logged as `database.replaced` and the worker should be
restarted.

### Connection pragmas

Each connection is tuned once, when it opens or reopens, in `applyPragmas`
(`readOnlyDatabase.ts`). Every value is read back after it is set, and
`readOnlyDatabaseStats().connections` reports what took effect. They work
through `node:sqlite` on a read-only connection, and the bundled SQLite 3.53
allows `mmap` (maximum 2,147,418,112 bytes, larger values are clamped).

| Pragma       | Default   | Environment variable                                    |
| ------------ | --------- | ------------------------------------------------------- |
| `query_only` | `1`       | `ATLAS_SQLITE_QUERY_ONLY=0` allows writes               |
| `temp_store` | `DEFAULT` | `ATLAS_SQLITE_TEMP_STORE` = `default`, `file`, `memory` |
| `cache_size` | `-2000`   | `ATLAS_SQLITE_CACHE_KIB`, a positive number of KiB      |
| `mmap_size`  | `0`       | `ATLAS_SQLITE_MMAP_BYTES`, `0` turns mapping off        |

The variables apply to every database file, are read at each open, and ignore
values that are not whole numbers. `query_only` also stops writes to temporary
tables, so a reader that needs one must turn it off.

The defaults come from `services/api/benchmarks/sqlite-pragmas.md`. On the
real 1.13 GB `atlas.sqlite`, a larger page cache, `mmap` and in-memory
temporary storage made no steady-state difference to postcode, area,
observation, aggregate or view reads. A page cache costs its size in
anonymous memory per connection, and every API worker has its own. `mmap` made
cold point lookups much faster (0.45 ms to 0.01 ms) but cold bulk reads slower,
and its pages count toward each worker's RSS as they are touched, up to the
mapped size (484 MiB after a postcode run with a 2 GiB limit). They are the
shared OS page cache, so workers do not hold separate copies, but a memory
limit that counts file pages still sees them. Raise the cache or `mmap` only
after measuring a workload that needs it, and budget `workers x cache`.

A mapped file renamed over stays valid for connections that have it open and
is unmapped when the connection closes, so a replaced file is unmapped when
its last lease is released (tested in `readOnlyDatabasePragmas.test.ts`).

A build stage that replaces a database it may have read calls
`closeReadOnlyDatabase(path)` just before the rename, or
`closeAllReadOnlyDatabases()`. Tests that rebuild fixtures do the same through
the pipeline writers. Writers open their own connections.

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

| Table               | Column        | Type                   | Key and meaning                                                                                                |
| ------------------- | ------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| `meta`              | `key`         | `TEXT`                 | Primary key. Currently only `schemaVersion`.                                                                   |
| `meta`              | `value`       | `TEXT NOT NULL`        | Database schema version, currently `"3"`.                                                                      |
| `payloads`          | `id`          | `TEXT NOT NULL`        | Primary key. `terrain-catalogue`, `dataset-manifest`, or `dataset:<output>` for datasets not served from rows. |
| `payloads`          | `payload`     | `BLOB NOT NULL`        | Brotli-compressed UTF-8 JSON text from its compiled input. It decompresses to the exact bytes and array order. |
| `dataset_catalogue` | `type`        | `TEXT NOT NULL`        | Primary key. Catalogue dataset type.                                                                           |
| `dataset_catalogue` | `output`      | `TEXT NOT NULL UNIQUE` | Compiled output name, without `.json`.                                                                         |
| `dataset_catalogue` | `source`      | `TEXT NOT NULL`        | JSON source metadata from the manifest.                                                                        |
| `dataset_catalogue` | `contract`    | `TEXT NOT NULL`        | JSON dataset contract.                                                                                         |
| `dataset_catalogue` | `summary`     | `TEXT NOT NULL`        | JSON compilation summary.                                                                                      |
| `dataset_catalogue` | `fingerprint` | `TEXT NOT NULL`        | Dataset compiler and input fingerprint.                                                                        |
| `dataset_catalogue` | `sha256`      | `TEXT NOT NULL`        | SHA-256 of the exact uncompressed payload bytes. For a dataset served from rows, the compiled input's hash.    |
| `dataset_catalogue` | `bytes`       | `INTEGER NOT NULL`     | Uncompressed UTF-8 payload length.                                                                             |
| `dataset_catalogue` | `payload_id`  | `TEXT`                 | Foreign key to `payloads.id`, `dataset:<output>`. Null for datasets served from rows.                          |

`meta`, `payloads`, `dataset_catalogue`, `area_releases`, `crosswalk_coverage_entry`, `named_location`, `named_location_member`,
`named_location_assertion`, `named_location_partial_member`, and `named_location_geometry` use `WITHOUT ROWID`. Each dataset has one payload. The complete
manifest is also retained as a payload to preserve its version, input provenance
and ordering. Reusing `payloads` keeps ready-to-send JSON in one table alongside
the terrain catalogue. The writer validates every dataset's hash and length.
SQLite enforces the payload foreign key during the build. `payloads` holds each
payload as a Brotli blob, quality 9, written by `packText` and read by
`unpackText` in `packages/atlas-runtime/src/storage/storedPayload.ts`. The table
shrinks from 9.5 MB to 0.4 MB, mostly the 8.5 MB `relationship-paths` payload,
which becomes 60 KB. Brotli beat gzip level 9 on the same payloads (60 KB
against 140 KB for `relationship-paths`) and decompressed that payload in 4 ms
against 9 ms. Quality 9 compresses it in 45 ms. Quality 11 was larger and took
5 s. Readers decompress transparently, so generation hashes and ETags still see
the exact text. `unpackText` also returns a text value as it is, so a database
written before compression, or a fixture that stores plain text, reads the
same way. Dataset payloads served from rows are the large ones, and the cache
stores them gzipped (see `atlas-cache.sqlite`).

The atomic writer rebuilds all tables, reading one dataset at a time. It avoids
retaining all payloads in memory. Incremental row updates would require copying
the database before mutation to retain atomic publication, so they are deferred.
The stage cache skips the whole write when inputs are unchanged.

`readTerrainCatalogue(repositoryRoot)` opens `data/build/atlas.sqlite` relative
to the repository root in read-only mode, reads the `terrain-catalogue` row, validates its
schema version and products array. It does not fall
back to JSON. Keep `data/build/atlas.sqlite` under the repository root when
deploying the API.
The `documents` stage depends on `atlas-sqlite` because it loads API catalogues.

`data/build/artifacts/terrain-catalogue.json` remains a build intermediate for
the shared SQLite writer. The API terrain loader
no longer reads it. The API catalogue compiler, API atlas pages and website SEO compilers read
dataset payloads from SQLite.
Gazetteer core and boundary assets remain API build intermediates under
`data/build/artifacts/source-data/`. Legacy provenance artifact labels in API
responses remain unchanged for byte compatibility.

The Next.js atlas pages pass a map of output names to hash-versioned URLs into
the client. `GET /data/catalogue/<sha256>/<output>.json` matches the output and
the hash of the served JSON, then returns it with
`Content-Type: application/json; charset=utf-8` and
`Cache-Control: public, max-age=31536000, immutable`: the stored payload, or for
a dataset served from rows the prebuilt cached payload. `readAtlasPayload("dataset:<output>")`
reads the same way. A cached payload is stored gzipped, and the route sends
those bytes as they are, with `Content-Encoding: gzip`, when the client accepts
gzip. It decompresses them for a client that does not. The `ETag` is
`W/"<sha256>"` of the JSON in either case, and every response has
`Vary: Accept-Encoding`. A payload that is not cached goes out as plain JSON,
which `next start` compresses. Missing outputs and stale or invalid
hashes return 404 with `Cache-Control: no-store`, never a different payload at
an old URL. A database deployment can therefore invalidate uncached old URLs;
pages and the compiled release must deploy together.

The website data build still reads `data/build/datasets/` to cut regional chunks. It
does not copy catalogue payloads into `public/data/datasets/`. That directory
still holds generated gazetteer, road-safety, regional chunk and SEO assets,
plus the website build manifest. The graph compiles shared datasets and SQLite
before running the website compilation stage. `pnpm data:build --from datasets`
rebuilds shared datasets, SQLite and their downstream consumers. `pnpm data:verify` checks the website manifest and assets,
including catalogue payload hashes in SQLite, and then runs the parity checks
described under "Parity checks" in `ARCHITECTURE.md`. It does not validate the relational
API tables or the complete compiled release.

### Statistics tables

`atlas-sqlite` writes the canonical statistics tables from
`docs/sqlite-schema-design.md` (layer 4). Every catalogue dataset is stored
in them. `UNSTORED_DATASETS` (`packages/atlas-runtime/src/catalogue/statisticsDatasets/`)
lists any exception with its reason, and is empty. The API reads its observations
from these same statistics rows. The base database schema version is 3.

`data-catalog` writes independently compiled observation artifacts under
`compiled-observations/`. `statistics-read-path` compares their values, statuses,
intervals, periods and areas with statistics-backed artifacts and records the
selectors in `statistics-read-path.json`. The build fails if an artifact cannot
be reconstructed. These compiler outputs are build inputs, not API storage.

All tables are `STRICT` with integer keys. Writer: `packages/atlas-runtime/src/catalogue/atlasStatistics.ts`.

| Table               | Key                                                                      | Meaning                                                                                                                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `source`            | `id`                                                                     | Publisher, URL and licence.                                                                                                                                                                                                                                                    |
| `dataset`           | `id`, `slug` unique                                                      | `module` (the topic: one of `core`, `economy`, `education`, `health`, `housing`, `crime`, `politics`, `environment`, `infrastructure`, `population`, `deprivation`, `transport`), title, description, `source_id`, compiler `fingerprint`. `slug` is the compiled output name. |
| `measure`           | `id`, `slug` unique                                                      | Shared across datasets. Unit, `value_kind`, `aggregation`, and numerator/denominator measures.                                                                                                                                                                                 |
| `dimension`         | `id`, `slug` unique                                                      | A breakdown such as `tenure` or `crime-type`.                                                                                                                                                                                                                                  |
| `dimension_member`  | `id`, unique `(dimension_id, code)`                                      | Member label, optional parent, publisher `position`.                                                                                                                                                                                                                           |
| `period`            | `id`, `label` unique                                                     | `kind`, `start_date`, `end_date`.                                                                                                                                                                                                                                              |
| `status`            | `id`, `slug` unique                                                      | `observed` (1), `estimated`, `provisional`, `suppressed`, `not_applicable`.                                                                                                                                                                                                    |
| `series`            | `id`, `key` unique                                                       | One dataset, measure, release (`area_releases.position`) and set of members, plus `method`.                                                                                                                                                                                    |
| `series_member`     | `(series_id, dimension_id)`                                              | The members fixing a series. Indexed by `(member_id, series_id)`.                                                                                                                                                                                                              |
| `observation`       | `(series_id, area_version_id, period_id)`                                | `value`, `status_id`, optional `lower`, `upper`, `category_id`. `WITHOUT ROWID`.                                                                                                                                                                                               |
| `dataset_area_name` | `(dataset_id, area_version_id)`                                          | A publisher's area name, stored only where it differs from `area_version.name`.                                                                                                                                                                                                |
| `area_relationship` | `(dataset_id, relation, period_id, child_version_id, parent_version_id)` | A publisher's statement, for a period, that one area contains (`parent`), was formed from (`predecessor`) was listed under the code of (`published-as`), or has the same extent as (`coterminous`) another.                                                                    |
| `election`          | `id`; unique `(dataset_id, label)`, `(dataset_id, date)`                 | An election a dataset holds: the publisher's label, kind (`general` or `local`), polling day and area release.                                                                                                                                                                 |
| `party`             | `id`; unique `code`, unique `key`                                        | A party named by a contest. `code` is the publisher's abbreviation (`Lab`), `key` the atlas's key for it (`LAB`), `name` and optional `colour` come from the dataset's declaration, else `name` is the code.                                                                   |
| `contest`           | `id`; unique `(election_id, area_version_id)`                            | One area's contest: the publisher's text, parties as `party` ids, and `region` and `country` as `area_version` ids where the name is a held area, else `region_text` and `country_text`.                                                                                       |
| `candidacy`         | `(contest_id, position)`                                                 | The candidate a contest elected: given name, family name and gender. `v_candidacy` adds the party's votes and share.                                                                                                                                                           |

`observation.area_version_id` references `area_version(id)`, one row per
release and code. `observation` has no secondary index: its primary key serves
series reads, and a place read passes the series of the area's release
(`WHERE series_id IN (...) AND area_version_id = ?`). `series` is indexed by `(dataset_id, measure_id)`
(`series_dataset`) and `series_member` by `(member_id, series_id)`
(`series_member_member`). The build fails if an observation's area is not in its series'
release, if an observed value is null, or if a dataset's `verify` hook fails.
`v_observation` joins everything into readable rows (dataset, measure, unit,
members, area code and name, geography, release, period, value, status,
method, licence).

Fuel poverty (`packages/atlas-runtime/src/catalogue/fuelPovertyStatistics.ts`) maps each record field to a
measure (`households`, `fuel-poor-households`, `fuel-poverty-rate`) on the 2021
LSOA release. Record order is area code order and is not stored; the mapper
refuses unordered input. The period header (`id`, `year`, `boundaryType`,
`boundaryYear`) is derived from the period and release. It is served from rows:
the build refuses to publish if the rebuilt values differ from the compiled JSON,
and stores no payload.

The other datasets are configuration in `packages/atlas-runtime/src/catalogue/statisticsDatasets/`, read by
`packages/atlas-runtime/src/catalogue/declaredStatistics.ts`. Each config names the record fields that hold
values, the measure and dimension members each one is, and the period. Every
number in a record must be claimed by a field or listed as `derived` with a
reason (per-100k figures, percentages the compiler computes, copies), and the
build checks the stored row count. Codes are placed on the header's release,
then on each `alsoIn` release in turn; a code in none of them fails the build
unless an `exclude` pattern gives a reason.

A config with `payload` has its JSON generated from rows, not stored.
`packages/atlas-runtime/src/catalogue/declaredPayload.ts` places each series'
values at the config's field paths in every record, and fills a value with no
observation as null. Names and keys come from `dataset_area_name` and
`dataset_area_key`, parent and other related areas from `area_relationship`,
contest text and winners from `contest` and `candidacy`, and numbers the
compiler computes from the config's `computed` rules. The config's `payload`
supplies what rows cannot say: each part's header, the record field holding
the area code, which containers are arrays, and header summaries computed from
the records (such as a deprivation index's figures for each district). A part
with no records fails the build unless declared optional, and a series that two
fields fit fails it unless one field `wins`. `payload.dropped` names header
fields of the compiled dataset that nothing in the rows can say, such as a
count of collisions with no area; the comparison ignores them.

The `atlas-sqlite` stage compares every generated payload with its compiled
dataset by value (numbers equal to within a relative 1e-9, nulls and absent
keys exact) and refuses to publish on a difference. The payload is not stored in
`payloads`; the stage generates it into `atlas-cache.sqlite`, whose entry
records the compiler hash to identify its source and the generated payload hash
for the website URL. The entry stores the JSON gzipped. Every configured dataset has a `payload`, so none keeps a
stored payload.

Run `pnpm exec vitest run --project built tests/built/datasetPayloads.test.ts`
to compare each rebuilt dataset with the compiled values and check its cache
entry and generated payload hash.

Run `pnpm exec vitest run --project built tests/built/statisticsDatasets.test.ts`
after a full build to check every configured dataset has rows and write
`data/build/statistics-datasets.json` (rows per dataset, bytes per table and
index).

Run `pnpm exec vitest run --project built tests/built/atlasStatistics.test.ts`
to compile the real fuel poverty payload and LSOA inventory, build an isolated
database through `buildAtlasSqlite`, and compare every byte. Other inventories
are empty fixtures. `data/build/statistics-pilot.json` records database bytes
with and without the statistics tables after vacuuming, the size of the area
index, and bytes per table and index where SQLite has `dbstat`. This measures the statistics tables, not a full release.

### Areas

`area_inventory_metadata` has one row keyed by integer `position = 0`, with
`schema_version INTEGER`, `content_hash TEXT`, and `boundary_registry_hash TEXT`, all
non-null. `area_releases` has the composite primary key `(geography, id)` and
unique integer `position` to preserve inventory order. Its non-null text columns
are `geography`, `id`, and `status`. Available releases have `recordCount INTEGER`,
`artifact TEXT`, `contentHash TEXT`, `codeProperty TEXT`, and `nameProperty TEXT`.
`derivedFrom TEXT` holds optional JSON source-adapter metadata. Unavailable
releases have `reason TEXT` instead. Inapplicable columns are null.

Area identity is three `STRICT` tables:

| Table          | Key                                  | Holds                                                                                                                             |
| -------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `geography`    | `id`, `slug` unique                  | One row per geography named by `area_releases`.                                                                                   |
| `area`         | `id`, `(code, geography_id)` unique  | One row per code in a geography, for all releases.                                                                                |
| `area_version` | `id`, `(release_id, area_id)` unique | The area in one release (`area_releases.position`): `name`, `area_m2`, `population`, JSON `aliases`, and `in_inventory` (0 or 1). |

`area_version.id` follows release order, then area artifact order, so release
reads order by `id`. Every other table references `area_version(id)`. Nullable
`aliases` keeps absent versus empty aliases. The same area in two releases
shares `area_id`. The `(code, geography_id)` index serves lookups by code.

`areas` is a read-only view over `area_version` and `area` with the earlier
columns (`id`, `releasePosition`, `code`, `inInventory`, `name`, `aliases`,
`areaM2`, `population`), kept for existing readers. Write to the tables.

The API inventory and bounded lazy area lookup read these tables over the
shared read-only connection (see Read-only connections). They refuse stale hashes and incomplete
releases and never fall back to JSON. SQLite runs before the
place-index, area-search-index, postcode-area, and atlas-lookup consumers.

The area inventory and `areas/*.json` remain build intermediates. Geometry
registry, crosswalk compilation, named-location compilation, compatibility, lookup manifest, validation,
geography inventory, location projections, relationship candidates, docs catalogue,
map resources, proposals, benchmarks
still read them. Atlas lookups use the migrated loader. Atlas pages read boundary
properties for area sizes. Producers write the manifests and gzip files under
`data/build/atlas-assets/`. The `pipeline/` workspace owns the `website-lookups`
stage, which validates and stores those release files in the `website_asset`
table of `website-assets.sqlite`, outside the release database. Its primary key is `(kind, id)`, where `kind` is
`pages` or `lookups`. Each row stores a SHA-256 hash and the original gzipped
JSON bytes. Website routes serve those bytes directly to gzip-capable clients;
server rendering and precompilation decompress the selected row. Old public
copies are removed only after a validated import succeeds. Next.js builds only
read these rows. API page and lookup routes read the gzip files under
`atlas-assets/`, so include that directory alongside SQLite in API deployments.
Other build outputs live under `data/build/artifacts/`. See
`docs/data-pipeline-move.md` for the migration history.

### Crosswalks

The Northern Irish 2021 data-zone membership adapter uses the publisher's
`LGD2014` fields to relate each data zone to the held 2025 local-authority
release. The archive-backed test checks that every source has one target and
that every referenced endpoint code exists in its release. The adapter declares
membership and does not claim geometric containment or provide weights.

`crosswalk_inventory_metadata` has one row keyed by integer `position = 0` with non-null
`schema_version INTEGER` and `content_hash TEXT`. Nullable `area_inventory_hash TEXT`
records whether release coverage is present. `crosswalk_coverage_entry` has primary
key `(geography, boundary_release)`, both non-null text, unique non-null integer
`position`, and non-null integers `area_count` and `related_area_count`.
Its rows retain coverage order and refer to the inventory hash, without requiring
all historical crosswalk endpoints to exist in `area_version`.

Crosswalks are integer edges between area versions. Every table is `STRICT`.

| Table                  | Key                                                        | Holds                                                                                                                                                                                                                                                             |
| ---------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crosswalk`            | `id` (inventory order), `slug` unique                      | `from_release_id` and `to_release_id` (`area_releases.position`), `method`, `quality`, `purpose`, JSON `weighting`, `basis_id`, `record_count`, `artifact`, `content_hash`, `header`, `bytes`, and the JSON field order of sources and targets.                   |
| `crosswalk_edge`       | `(crosswalk_id, from_version_id, to_version_id)`           | One source and target pair. `relation` (best fit: `within`, `straddles`, `indeterminate`) and `change` (official lookups: `unchanged`, `split`, `merged`, `complex`) are null where the crosswalk does not give them. Indexed by `(crosswalk_id, to_version_id)`. |
| `weight_basis`         | `id`                                                       | `area`, `population`, `postcodes` or `households`, with a label. A new basis is a row.                                                                                                                                                                            |
| `crosswalk_weight`     | `(crosswalk_id, from_version_id, to_version_id, basis_id)` | One row per edge and basis: `weight` (share of the covered source, summing to 1 per source), `overlap` (square metres, residents, households or postcodes), `source_share` and `target_share`. See "Weights from postcodes".                                      |
| `crosswalk_edge_check` | as `crosswalk_edge`                                        | Sparse matching diagnostics: `contained_share`, `outside_width_m`, `match`, `widest_difference_m`, `claimed_difference_m`, unweighted `check_source_share` and `check_target_share`, and `overlap_area_m2` on population-weighted crosswalks.                     |
| `crosswalk_source`     | `(crosswalk_id, from_version_id)`                          | Only sources with `coverage`, or with no targets.                                                                                                                                                                                                                 |
| `crosswalk_label`      | `(crosswalk_id, area_version_id)`                          | Publisher labels, only where they differ from `[name, ...aliases]`.                                                                                                                                                                                               |

Order is not stored. Records are in source code order and targets in target code
order; the build refuses input that is not. Source `areaM2` and `population` are
facts on `area_version`, so every source in one crosswalk must give the same
fields, and the build rejects conflicting facts for the same area. A target
field is stored only when present; a null value is refused because it could not
be told apart from a missing one. Missing weights stay null, distinct from zero.
`header` is the artifact metadata with a null `records` placeholder, and `bytes`
keeps the original JSON byte count for the API cache budget. `v_crosswalk_edge`
shows each edge with codes, names and its weights, one row per basis (an edge
without weights appears once, with null weight columns).

`crosswalk.basis_id` is the basis the crosswalk's own artifact declares (`area`
or `population`), and artifacts rebuild from that basis alone. Other bases on
the same edges are in `crosswalk_weight` only: select by `basis_id`.

#### Weights from small-area counts

Two stages weight crosswalks from the same atoms, and `assemble-atlas` copies the
result into `crosswalk_weight`. `weight-atoms` runs first, to place the atoms
in the releases the `postcode-overlap` crosswalks join (they are compiled from
it); `crosswalk-weights` then weights the edges of every crosswalk that does not
regroup exactly, placing the releases it still needs.

**Atoms.** A weight is a sum over atoms: every live, small-user postcode with a
grid reference (1.68 million), and each output area that has people but no such
postcode (127), at its population weighted centroid. A basis's count is held for
each output area and shared equally between its atoms, so an output area inside
both areas of a pair puts its whole count in the pair, and one on a border is
split by its postcodes. Each release an edge joins is placed once, in turn, in a
worker holding only that release's geometry (a point on the border of several
areas, or in none, is placed nowhere). Placements are kept in
`data/build/weight-atoms/placements/` (for the postcode-overlap releases) and
`data/build/crosswalk-weights/placements/` to skip releases that have not
changed; they are intermediates and do not ship.

| Basis        | Count shared between an output area's atoms                                                                           | Source                                                                                                      |
| ------------ | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `postcodes`  | 1 for each postcode                                                                                                   | ONS Postcode Directory                                                                                      |
| `population` | Census 2021 usual residents (TS001) of each England and Wales output area; Census 2022 residents of each Scottish one | Nomis bulk download `census2021-ts001.zip`; NRS `outputarea2022_usualresidentpopulation.csv`                |
| `households` | Census 2021 households (TS003); Scotland: Census 2022 occupied household spaces (UV406)                               | Nomis bulk download `census2021-ts003.zip`; NRS table UV406 by output area, mirrored by the UK Data Service |
| `dwellings`  | Council Tax properties of each LSOA, split between its output areas by their households. England and Wales only       | VOA Council Tax: stock of properties 2026, table CTSOP1.1 (rounded to the nearest 10; 31 March 2026)        |

`pnpm --dir pipeline fetch:onspd` and `fetch:weight-sources` download these
(also the 2021 output area of each postcode, `onspd-output-areas.csv.gz`, and
the centroids: ONS `OA_December_2021_EW_PWC_V4` and NRS `output-area-2022-pwc.zip`).
The URLs are in each source folder's `meta.json`. Northern Ireland has no
postcodes or counts here, and Scotland has no dwelling count.

**Rows.** For each edge and basis, `overlap` is the measure inside both areas,
`weight` is the overlap as a share of the overlaps of the source's edges (so a
source's weights sum to 1), and `source_share` and `target_share` are the
overlap as a share of the whole source and the whole target. A best-fit edge
whose ward straddles two constituencies therefore has a `weight` of 1 and a
`source_share` below 1. No edge is added to a crosswalk, and a pair with
nothing in it has no row. A crosswalk keeps its own basis: a population-overlap
crosswalk gets `postcodes`, `households` and `dwellings`, not a second
`population`. The counts are for 2021 to 2022 and the postcodes for August 2026,
and a pair that splits an output area is only as good as an even spread of its
count over that area's postcodes.

**Exact edges.** An edge whose source lies wholly in its target weighs 1 on
every basis, so it has no stored row. This is the rule, in
`crosswalk-weights/exactEdges.ts`: the crosswalk is `extent-continuity`,
`clean-containment` or `geometric-containment`; or an `official-lookup` of
membership; or the edge's `change` is `unchanged`; or its best-fit `relation` is
`within`. Query `v_crosswalk_weight`, not `crosswalk_weight`: it returns the
stored rows (`derivation = 'stored'`) and an implicit row for each exact edge and
each basis in `weight_basis` (`derivation = 'exact'`, `weight = 1`,
`source_share = 1`, null `overlap` and `target_share`). An edge that is neither
exact nor stored has no weight.

**Single-target sources.** A source of a `postcode-overlap` crosswalk with
exactly one target (90% of them) weighs 1 on every basis too, so only the
crosswalk's own residents row is stored for it, and the view returns the other
bases with `derivation = 'single-target'`, `weight = 1` and null `overlap`,
`source_share` and `target_share`. Other methods store theirs: a best-fit
straddler's one edge is where its `source_share` says how little of it is there.

#### Postcode-overlap crosswalks: lookup or conversion

Two kinds of crosswalk join a ward release to a constituency release, and they
answer different questions.

| Method             | Edges                                                                                             | Use it to                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `best-fit`         | One per ward: the constituency holding most of its area. `relation` says `within` or `straddles`. | Ask which constituency a ward is in (a lookup).                             |
| `postcode-overlap` | One per constituency the ward has residents in. `weight` sums to 1 per ward.                      | Convert counts or rates from wards to constituencies (`purpose=apportion`). |

`best-fit` stays as it was. A `postcode-overlap` crosswalk is compiled for each
ward release to each constituency release a best-fit crosswalk joins (26), by
`pipeline/src/relationships/postcodeOverlap.ts`, from the atoms placed in both
releases. Every pair of areas with an atom in both is an edge, except a pair
holding under 1% of its source's measure on every basis (postcodes, residents,
households, dwellings): the same rule for every crosswalk, recorded as
`weighting.minimumShare`, which drops the stray postcodes where generalised
borders disagree. A source's weights, which are shares of its residents, are
renormalised over the edges kept, and `coverage` on the source says what share
of its residents they hold. Residents are the crosswalk's own basis
(`crosswalk.basis_id = 'population'`, with `source.population` the estimated
residents of the ward); `postcodes`, `households` and `dwellings` are added
beside it in `crosswalk_weight`.

Northern Ireland wards are only in the `best-fit` crosswalks. The ONS Postcode
Directory used here has no Northern Ireland postcodes, so a ward there has no
atoms and nothing to weigh: it has a record with no targets, and no edges are
made up for it. Each crosswalk's `validation.coverage` counts these
(`unplacedSources`, 8,316 across the 26) with the reason, "no postcodes in ONSPD
for Northern Ireland", and the `postcode-overlap-coverage` finding fails for any
source that has no target for another reason. A source whose atoms were all
placed nowhere would be one: that is how the Dolgellau wards, drawn as an
enclave inside a ward without its hole, were found, and a point inside several
areas is now placed in the one nested in the others.

### Named locations

`named_location_inventory_metadata` has one row keyed by integer `position = 0`. Its
non-null columns are `schema_version INTEGER`, `content_hash TEXT`, `artifact TEXT`
and `gazetteer_version INTEGER`. The last two describe the source gazetteer.

`named_location` has text primary key `id`, unique integer `position`, text
`fields`, `label`, `kind`, and `member_geography`, integer `definition_revision`,
and real `min_x`, `min_y`, `max_x`, `max_y`. These columns are non-null. Nullable text
`valid_from` and `valid_to` retain the definition's half-open validity interval.
Nullable `source TEXT` contains the publisher-specific provenance object as JSON.
`fields` is an ordered JSON list of property names. It preserves optional arrays,
including absent versus empty arrays, and response property order. Indexes on
`(kind, position)` and `(member_geography, position)` support filtered inventories.

Membership data lives in relational child tables. Each has non-null
`location_id TEXT`, a foreign key to `named_location.id`, and non-null
`position INTEGER`, with composite primary key `(location_id, position)`.

- `named_location_member` has non-null `code TEXT`, preserving declared member order.
- `named_location_assertion` has non-null `code TEXT` and nullable text
  `valid_from`, `valid_to` for each dated membership assertion. An index on
  `(location_id, code, valid_from, valid_to)` supports dated membership lookups.
- `named_location_partial_member` has non-null `code TEXT`, `share REAL`, and
  `member_of TEXT`. Zero shares remain zero.

Members and partial members index `(code, location_id)` for reverse membership
lookups. Codes refer to the parent's `member_geography`. They have no foreign key
to `area`, because assertions can describe historical codes across releases.
`member_of` is a foreign key to the named location holding that partial member.

`named_location_geometry` has text primary key `location_id`, a foreign key to
`named_location.id`, non-null `boundary_release TEXT`, real `min_x`, `min_y`,
`max_x`, `max_y`, and `geometry BLOB NOT NULL`. The blob is the GeoJSON geometry
as Brotli-compressed UTF-8 JSON (quality 10), written by `packGeometry` and read
by `unpackGeometry` in `packages/atlas-runtime/src/storage/storedGeometry.ts`.
Coordinates are WGS84 longitude and latitude in degrees, rounded to five decimal
places, about 1.1 m of latitude. Neighbouring points that round together are
merged, and a ring that collapses below four positions is dropped, though no
ring did in the current data. The bounds columns are measured from the rounded
geometry, so they match what the API returns, and differ from the unrounded
union by at most 0.000005 degrees. `named_location` keeps its own full
precision bounding box. Rounding and compression shrink the table from 25.7 MB
to 4.2 MB for 249 rows. Gzip gave 5.9 MB and Brotli quality 9 gave 6.0 MB.
Quality 11 gave 3.6 MB for three times the build time of quality 10. Binary
WKB was not used: its 16 bytes per position would need a separate encoding to
compete with compressed text, and it would not read as JSON. Only the API's
`/v1/locations/{id}/geometry` route returns this geometry, and nothing computes
from it, so rounding changes no other output. `unpackGeometry` also accepts
plain JSON text. Geometry is optional, one row per location with a compiled
union. Its release belongs to the parent's `member_geography`. The API loads
geometry on first access over the shared read-only connection. Inventory and
membership reads do not parse geometry.

The named-location compiler reads area JSON intermediates before SQLite is
built, avoiding a dependency cycle. The API inventory loader and place-index
compiler read named locations from SQLite. Full named-location JSON remains for
location projections, lookup exports. Packed metadata and
geometry JSON remain build outputs of the same compiler, although the API no
longer reads them. Atlas pages use the resolver's migrated loader and write
release artifacts that the pipeline stores in `website_asset` in
`website-assets.sqlite`.

### Location projections

`location_projection_member` and `location_projection_parent` have composite
primary keys `(crosswalk_id, key)`, both non-null text, and non-null `value BLOB`.
Each row stores one JSON projection compressed with its shard's dictionary.
`location_projection_dictionary` has composite primary key `(kind, crosswalk_id)`
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

## Compiled intermediates and who reads them

`atlas-sqlite` writes the areas, crosswalks and named locations in
`artifacts/` into `atlas-base.sqlite`. The JSON stays, because the stages that
compile and write it read it, and no website or API code reads it at run time.

| JSON                                     | Read by                                                                                                                                                                                                                                            |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `areas/<geography>/<release>.json` (115) | `geometry-source-registry`, `crosswalk-inventory` (and each of its workers), `named-locations`, `location-projections`, `atlas-sqlite`, `map-resource`, `lookup-manifest`, `relationship-candidates`, `measure-compatibility`, `validation-report` |
| `crosswalks/*.json.gz` (181)             | `crosswalk-inventory` (its own output, when reusing), `location-projections`, `atlas-sqlite`, `lookup-manifest`, `validation-report`, `analysis-geography-validation`                                                                              |
| `named-locations.json`                   | `location-projections`, `atlas-sqlite`, `lookup-manifest`                                                                                                                                                                                          |

Reading from SQLite is not always cheaper, so each stage reads what suits its
access pattern. Measured on the 2026-11 release (980,726 area versions, 181
crosswalks, 1.9 million edges, one process each; times vary by up to 2x with
load on the machine, peak memory does not):

| Read                                  | Compiled JSON           | `atlas-base.sqlite`   |
| ------------------------------------- | ----------------------- | --------------------- |
| every area of every release           | 0.7 s                   | 1.7 s                 |
| every crosswalk, whole, one at a time | 4.4 s, 507 MB peak RSS  | 27 s, 1.1 GB peak RSS |
| every crosswalk held at once          | 7.2 s, 0.99 GB peak RSS |                       |
| named locations, without geometry     | 0.35 s, 270 MB          | 11 ms, 110 MB         |
| each crosswalk's shape (one to one)   | 4.7 to 15 s, 0.4 GB     | 0.4 s, 109 MB         |

A stage that needs a few columns or an aggregate reads SQLite. A stage that
needs every record of a crosswalk reads its one gzipped JSON file, which is
already compact and faster to parse than the records can be rebuilt. The
stages that cost memory were holding every crosswalk or every lookup table at
once, not parsing more than they needed.

- `relationship-paths` reads each crosswalk's shape with `readCrosswalkShapes`
  (`pipeline/src/storage/buildIntermediates.ts`), a query over the edges, and
  depends on `atlas-sqlite`. It was 4.7 to 15 s and 0.4 GB, and is 0.7 to 1 s and
  0.18 GB, with the same output. The dependency adds no wait: its consumers
  already follow `atlas-sqlite` through `statistics-read-path`.
- `lookup-manifest` builds and renders one lookup table at a time
  (`compileLookupManifest` takes an iterable of tables), where it held all 181
  crosswalk tables and 115 area tables. It was 22 to 53 s and 1.8 GB, and is 13
  to 18 s and 0.79 GB, with a byte for byte identical manifest.
- `analysis-geography-validation` and `validation-report` read crosswalks
  through `createCrosswalkArtifacts` (`pipeline/src/storage/crosswalkArtifacts.ts`),
  which parses a file when first asked for and holds at most 64 MB of JSON
  text. Analysis validation routes through one crosswalk, so it parses 1 of
  181 files, not all (the read took 7.2 s and 0.99 GB, and now 65 ms and
  0.13 GB). The validation report visits each once, so it holds one at a time
  (3.7 s and 0.66 GB for the read).

- `location-projections` runs before `atlas-sqlite`, so it reads the JSON, but
  through the same loader, one crosswalk at a time and with one pass over
  them. It was 21.5 s and 1.56 GB, and is 17.5 s and 0.97 GB, with identical
  projections.

`pipeline/src/storage/buildIntermediates.ts` also has `readAreas({ geography,
release, fields })`, which streams the requested columns, `readAreaInventory`,
`readCrosswalk(from, to)`, `readCrosswalkById`, `readCrosswalks`,
`readNamedLocations` (geometry loads only when used) and
`readCrosswalkShapes`. They read `atlasBaseDatabasePath(root)`, the file
`atlas-sqlite` writes, unless given another path. A stage that uses them must
list `atlas-sqlite` in its dependencies, so it waits for the tables and its
cache key follows them. `assemble-atlas` copies the file into `atlas.sqlite`,
so a stage that runs before it reads `atlas-base.sqlite`.

Stages upstream of `atlas-sqlite` cannot read these tables and stay on the
JSON: `geometry-source-registry`, `crosswalk-inventory`, `named-locations` and
`location-projections` (which `atlas-sqlite` waits for). `map-resource` is on
the longest path of the build (about 22 minutes), so waiting for `atlas-sqlite`
would lengthen the build, and it reads only code and name from one release at a
time. `measure-compatibility` and `relationship-candidates` need whole area
releases, which are faster to read as JSON, and their memory is not in the
area read. No JSON file was dropped: each is still written by the stage that
compiles it and read by `atlas-sqlite`.

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

`place_index_meta`, `place_index_place`, `place_index_name` and
`place_index_code` store the place search index in `atlas-cache.sqlite`. Places,
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

`area_search_meta`, `area_search_code`, `area_search_term` and
`area_search_title_term` store area search in `atlas-cache.sqlite`. Codes keep their
release order and terms keep their packed postings. Search still reads only the
rows needed for matching, filters and pagination.

The `area-search-index` stage replaces its tables in a temporary copy of the
local cache and publishes it atomically, retaining other cache components. Successful builds remove the separate database and both old JSON
variants from `services/api/public/`. The source data release excludes the cache.

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
postcode-index stage removes the area sets and distances, so rebuild postcode-areas afterward,
even when the postcode content hash is unchanged. No new source release is needed.

### Postcode areas

The `postcode-areas` stage stores area references once per distinct combination of
areas. `postcode_area_set` has an `id` and one `AreaId` column per compiled release,
each referencing `area_version(id)`, and is `STRICT`. `postcodes` keeps one
`area_set_id INTEGER NOT NULL REFERENCES postcode_area_set(id)` and a `DistanceCm`
column per release. A geography with one release uses names such as `countryAreaId`.
Multiple releases use release-qualified names such as
`"localAuthority_2026-05-uk-bgcAreaId"`. `postcode_area_releases` lists each
geography, boundary release and column name. `areaColumn` names a column of
`postcode_area_set` and `distanceColumn` a column of `postcodes`.
`distanceFallback` is null, or the position of an earlier release; see below.
All IDs refer to that exact boundary release. Missing inventory areas are added
as `area_version` rows with `in_inventory = 0` and an empty name, since shard inputs contain codes
but no labels.

Set IDs count up from 1 in first-seen postcode order, so builds are reproducible.
The writer deduplicates with an in-memory map rather than a unique index, which
would cost another copy of the table and would not treat null areas as equal.
Distances differ for almost every postcode, so they stay on `postcodes`.

A `DistanceCm` column is stored as null where the release named by its
`distanceFallback` holds the same nonzero distance, as when both releases share
an area's boundary. Read the value as the first non-null along the chain of
fallbacks, which always point to earlier positions. Columns with no fallback are
never null, and zero is always stored as zero. The writer picks each fallback
as the earlier release that matches most often, the earliest on a tie. This is
lossless: the reader rebuilds the same centimetres and shard bytes, and
`postcodes_decoded` returns the resolved values. On the 2.67 million postcode build it
cut `postcodes` by about 105 MB.

```sql
SELECT p.postcode, a.code, a.name
FROM postcodes p
JOIN postcode_area_set s ON s.id = p.area_set_id
JOIN areas a ON a.id = s.countryAreaId
WHERE p.postcode = 'SW1A1AA';

SELECT postcode, countryCode FROM postcodes_decoded
WHERE postcode = 'SW1A1AA';

SELECT geography, boundaryRelease, areaColumn, distanceColumn
FROM postcode_area_releases;
```

`postcodes_decoded` joins through the set table and returns the same columns as
before: the postcode fields, each `AreaId` and `DistanceCm` pair, then each `Code`.

A null area ID means no single interior match. `postcode_area_matches` holds
multiple or boundary matches, with their containment, distance and original order.
Its decoded view, `postcode_area_matches_decoded`, adds geography, boundary
release, code and name. `postcode_area_columns` preserves release order and the
presence of the optional several-match field per district. `postcode_area_codes`
preserves each district's code dictionary as ordered references to `area_version`.
These small tables retain the details needed to reconstruct the original bytes.

The `postcode-areas` stage places each postcode once and writes the shards. The
`verify-postcode-areas` check stage reads them back and compares every 5,000th
postcode, and every postcode in several areas, with a live containment and
nearest-edge lookup. A local build skips it; `pnpm data:build --verify` and
`pnpm data:verify` run it.

The reader selects a compact-postcode prefix range, filters to the district's
postcode length, and orders by postcode using the primary key. This reproduces
the compiler's code-unit order, including districts such as M1, M10 and M1A.
It reconstructs the original district JSON and verifies the manifest SHA-256
before returning it. Postcode and area content hashes and API ETags are unchanged.

Build this schema through the normal atlas and postcode build stages. The
postcode-area writer checks every reconstructed area shard before publishing its
temporary database atomically. Rebuild older databases with the current builders;
the runtime supports only the current schema. The writer records `postcodeAreaLayout`
(currently `"3"`) in `meta`. Postcode area readers throw, naming the rebuild, when
it is missing or different, as it is for a database that stores `AreaId` columns
on `postcodes` (layout 1) or has no `distanceFallback` (layout 2).

Compare an old database with the rebuilt database using
`NODE_OPTIONS=--max-old-space-size=2560 npx tsx services/api/scripts/compare-postcode-sqlite.ts BEFORE.sqlite services/api services/api/benchmarks/sqlite-postcode-areas.json`.
The check requires nonempty shard inventories and exits nonzero on any byte or
hash mismatch. It reports both shard counts, mismatch counts, database bytes,
`dbstat` bytes per object, and nine warm timing samples for the largest area
shard and a direct postcode lookup. Each timed read opens its own connection.

Deprecated read-only compatibility views preserve the earlier names and column
spellings. New queries should use the stored tables:

| Deprecated view                               | Stored table                        |
| --------------------------------------------- | ----------------------------------- |
| `datasets`                                    | `dataset_catalogue`                 |
| `website_assets` (in `website-assets.sqlite`) | `website_asset`                     |
| `area_inventory`                              | `area_inventory_metadata`           |
| `crosswalk_inventory`                         | `crosswalk_inventory_metadata`      |
| `crosswalk_coverage`                          | `crosswalk_coverage_entry`          |
| `named_locations`                             | `named_location`                    |
| `named_location_inventory`                    | `named_location_inventory_metadata` |
| `named_location_members`                      | `named_location_member`             |
| `named_location_assertions`                   | `named_location_assertion`          |
| `named_location_partial_members`              | `named_location_partial_member`     |
| `named_location_geometries`                   | `named_location_geometry`           |
| `cache_generations`                           | `cache_generation`                  |
| `dataset_payloads`                            | `dataset_payload`                   |
| `location_projection_members`                 | `location_projection_member`        |
| `location_projection_parents`                 | `location_projection_parent`        |
| `location_projection_dictionaries`            | `location_projection_dictionary`    |
| `place_index_places`                          | `place_index_place`                 |
| `place_index_names`                           | `place_index_name`                  |
| `place_index_codes`                           | `place_index_code`                  |
| `area_search_codes`                           | `area_search_code`                  |
| `area_search_terms`                           | `area_search_term`                  |
| `area_search_title_terms`                     | `area_search_title_term`            |
