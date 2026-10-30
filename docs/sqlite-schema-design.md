# Canonical SQLite schema design

Status: proposal, 2026-10-26. Step 1 (the observation model, with fuel
poverty ported onto it) is implemented, and every catalogue dataset except
elections and NHS waiting times is stored as rows from configuration; see
[Decisions](#decisions) and [How to port a dataset](#how-to-port-a-dataset). The current schema is
documented in `data/build/README.md`.

## Goal

`atlas.sqlite` should be a database of UK geography and public statistics that
stands on its own. Someone (or an AI agent) given only the file should be able
to answer "unemployment in Manchester, 2015 to 2024, on 2024 boundaries" with
plain SQL, see where each number came from, and know whether it was published
or derived.

Today the file is mostly a store of build outputs for the API and website.
Boundaries, lineage and crosswalks are relational, but most statistics are JSON
blobs, and many columns exist to rebuild those blobs byte for byte.

## Problems with the current schema

Measured on the 2026-10-25 build (1.6 GB, 28 tables).

1. **Statistics are mostly opaque.** 64 rows in `payloads` and 322 rows in
   `observation_artifacts` hold almost every value as JSON. Only fuel poverty
   exists as rows (`catalogue_observations` pilot).
2. **Three observation models.** Website JSON payloads, the API's
   `observation_*` tables (with one generated table per census cube), and the
   catalogue pilot. Each identifies areas differently: a code inside JSON,
   `observation_areas(code)`, or `areas(id)`.
3. **Dimensions are encoded in measure ids.** For example
   `general-election-con-vote-share-constituency-2019`, `crime-burglary`,
   `ethnicity-african`, `car-availability-two`. Party, crime type, geography
   and year live in strings, so "every party" or "all crime types" needs string
   matching.
4. **Reconstruction columns.** `position`, `fields`, `header`, and JSON
   `labels` / `aliases` exist to rebuild response JSON exactly. That is a
   migration constraint, not a modelling one.
5. **Crosswalks are large.** About 890 MB of tables and indexes for 1.9M
   edges, roughly 200 bytes per edge. Edges repeat text codes and JSON labels,
   and `crosswalk_targets` has 15 nullable columns because several crosswalk
   kinds share one table. The integer layout experiment in
   `.data-release/sqlite-analysis/` reached 424 MB and halved query time; the
   column layout experiment reached 298 MB.
6. **No lasting area identity.** `areas` is keyed by release and code. Nothing
   states that a code in the 2015 and 2024 releases is the same area, which is
   why `named_location_members.code` has no foreign key.
7. **Derived data mixed with canonical data.** Search postings, compressed
   location projections, postcode shards and payload JSON can all be rebuilt
   from other rows. Some have moved to `atlas-cache.sqlite`; the rest should
   follow.
8. **Not self-describing.** SQLite has no column comments, and table meaning
   lives in a 400-line README outside the file.

## Principles

- **Model the domain, not the API responses.** Response shapes are built from
  rows, in code or in the cache.
- **One fact, one place.** Nothing in `atlas.sqlite` duplicates data derivable
  from its own rows.
- **Integer surrogate keys, text natural keys with `UNIQUE`.** Keeps the large
  tables narrow while every table stays readable by code.
- **Every table is `STRICT`, with real foreign keys and `CHECK` constraints.**
  `PRAGMA foreign_key_check` must pass at the end of every build.
- **New datasets are configuration.** Adding a dataset means declaring its
  measures, dimensions and members, not writing a table writer.
- **Provenance is on every series.** Source, licence, method (published,
  converted, modelled) and what it was derived from.
- **Self-describing.** Documentation tables and readable views ship inside the
  file.
- **Order by meaning.** Drop `position` unless order carries meaning (ballot
  order, publisher's category order).

## Files

| File                     | Contents                                            | Distributed |
| ------------------------ | --------------------------------------------------- | ----------- |
| `atlas.sqlite`           | Identity, relationships, statistics, documentation  | Yes         |
| `atlas-geometry.gpkg`    | Simplified geometry per area version, R\*Tree index | Yes         |
| `atlas-postcodes.sqlite` | Unit postcodes and their area links                 | Yes         |
| `atlas-cache.sqlite`     | Payload JSON, search postings, projections, assets  | No          |
| `tiles/*.pmtiles`        | Map tiles                                           | Yes         |

The distributed files share integer ids, so they join with `ATTACH`:

```sql
ATTACH 'atlas-geometry.gpkg' AS geo;
SELECT v.name, g.geom FROM area_version v JOIN geo.area_geometry g ON g.area_version_id = v.id;
```

`atlas-geometry.gpkg` is a valid GeoPackage (a SQLite profile), so QGIS, GDAL,
geopandas and DuckDB open it directly. Full-detail geometry stays in
GeoParquet and PMTiles. The core file stays small enough to upload to an AI
sandbox; the size target is a few hundred MB, to be measured.

## Schema

DDL is indicative. All tables are `STRICT`. Large child tables are
`WITHOUT ROWID` with the stated primary key.

### 1. Identity

What places exist, and when.

```sql
CREATE TABLE nation (
  id    TEXT PRIMARY KEY,          -- E, W, S, N
  label TEXT NOT NULL
) STRICT;

CREATE TABLE geography (
  id          INTEGER PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,  -- lad, ward, lsoa, constituency
  label       TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('administrative','statistical','electoral','health','postal','other')),
  description TEXT NOT NULL
) STRICT;

CREATE TABLE boundary_release (
  id           INTEGER PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE, -- 2025-12-en-bgc
  geography_id INTEGER NOT NULL REFERENCES geography(id),
  valid_from   TEXT NOT NULL,        -- ISO date, half-open interval
  valid_to     TEXT,
  resolution   TEXT,                 -- BFC, BGC, BUC
  source_id    INTEGER NOT NULL REFERENCES source(id),
  status       TEXT NOT NULL CHECK (status IN ('available','unavailable')),
  reason       TEXT
) STRICT;

-- One row per code, for all time.
CREATE TABLE area (
  id           INTEGER PRIMARY KEY,
  geography_id INTEGER NOT NULL REFERENCES geography(id),
  code         TEXT NOT NULL,
  nation_id    TEXT REFERENCES nation(id),
  UNIQUE (geography_id, code)
) STRICT;

-- The area as it appears in one release.
CREATE TABLE area_version (
  id          INTEGER PRIMARY KEY,
  area_id     INTEGER NOT NULL REFERENCES area(id),
  release_id  INTEGER NOT NULL REFERENCES boundary_release(id),
  name        TEXT NOT NULL,
  area_m2     REAL,
  centroid_x  REAL,                  -- British National Grid
  centroid_y  REAL,
  min_x REAL, min_y REAL, max_x REAL, max_y REAL,
  UNIQUE (release_id, area_id)
) STRICT;

CREATE TABLE area_name (
  area_id INTEGER NOT NULL REFERENCES area(id),
  name    TEXT NOT NULL,
  lang    TEXT NOT NULL DEFAULT 'en',  -- en, cy, gd
  kind    TEXT NOT NULL CHECK (kind IN ('official','alias','historic','publisher')),
  PRIMARY KEY (area_id, name, lang)
) STRICT, WITHOUT ROWID;

-- Lineage: reorganisations, recodes, renames.
CREATE TABLE area_event (
  id         INTEGER PRIMARY KEY,
  date       TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('create','abolish','merge','split','rename','recode','boundary_change')),
  instrument TEXT,                     -- legislation reference
  source_id  INTEGER REFERENCES source(id)
) STRICT;

CREATE TABLE area_event_link (
  event_id INTEGER NOT NULL REFERENCES area_event(id),
  area_id  INTEGER NOT NULL REFERENCES area(id),
  role     TEXT NOT NULL CHECK (role IN ('from','to','affected')),
  PRIMARY KEY (event_id, area_id, role)
) STRICT, WITHOUT ROWID;
```

The `area` and `area_version` split follows the ONS Code History Database: a
code is a lasting identity, and each release holds a dated version of it.
Publisher-specific labels (such as fuel poverty's LSOA names) become
`area_name` rows of kind `publisher`, not a column per observation.

### 2. Places

Named locations people talk about: ceremonial and historic counties, city
regions, national parks.

```sql
CREATE TABLE place (
  id                 INTEGER PRIMARY KEY,
  slug               TEXT NOT NULL UNIQUE,
  label              TEXT NOT NULL,
  kind               TEXT NOT NULL,
  member_geography_id INTEGER NOT NULL REFERENCES geography(id),
  valid_from TEXT, valid_to TEXT,
  definition_revision INTEGER NOT NULL,
  source_id          INTEGER REFERENCES source(id)
) STRICT;

CREATE TABLE place_member (
  place_id   INTEGER NOT NULL REFERENCES place(id),
  area_id    INTEGER NOT NULL REFERENCES area(id),
  valid_from TEXT NOT NULL DEFAULT '',
  valid_to   TEXT,
  share      REAL NOT NULL DEFAULT 1 CHECK (share > 0 AND share <= 1),
  PRIMARY KEY (place_id, area_id, valid_from)
) STRICT, WITHOUT ROWID;
CREATE INDEX place_member_area ON place_member (area_id);
```

This replaces `named_location_members`, `_assertions` and `_partial_members`.
Historical codes are `area` rows, so the foreign key always holds. Place
geometry moves to `atlas-geometry.gpkg`.

### 3. Relationships

```sql
CREATE TABLE crosswalk (
  id              INTEGER PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  from_release_id INTEGER NOT NULL REFERENCES boundary_release(id),
  to_release_id   INTEGER NOT NULL REFERENCES boundary_release(id),
  method          TEXT NOT NULL,    -- published, best_fit, overlay, derived
  quality         TEXT NOT NULL,
  purpose         TEXT,             -- identity, membership, succession
  source_id       INTEGER REFERENCES source(id),
  provenance      TEXT              -- JSON: validation, inputs (small, per crosswalk)
) STRICT;

CREATE TABLE crosswalk_edge (
  crosswalk_id    INTEGER NOT NULL REFERENCES crosswalk(id),
  from_version_id INTEGER NOT NULL REFERENCES area_version(id),
  to_version_id   INTEGER NOT NULL REFERENCES area_version(id),
  relation        TEXT NOT NULL CHECK (relation IN ('equal','within','contains','overlaps')),
  PRIMARY KEY (crosswalk_id, from_version_id, to_version_id)
) STRICT, WITHOUT ROWID;
CREATE INDEX crosswalk_edge_to ON crosswalk_edge (crosswalk_id, to_version_id);

CREATE TABLE weight_basis (
  id    TEXT PRIMARY KEY,           -- area, residents, households, dwellings, uprns, workplaces
  label TEXT NOT NULL
) STRICT;

CREATE TABLE crosswalk_weight (
  crosswalk_id    INTEGER NOT NULL,
  from_version_id INTEGER NOT NULL,
  to_version_id   INTEGER NOT NULL,
  basis_id        TEXT NOT NULL REFERENCES weight_basis(id),
  source_share    REAL NOT NULL,    -- share of the source area going to the target
  target_share    REAL,             -- share of the target area from the source
  PRIMARY KEY (crosswalk_id, from_version_id, to_version_id, basis_id),
  FOREIGN KEY (crosswalk_id, from_version_id, to_version_id)
    REFERENCES crosswalk_edge (crosswalk_id, from_version_id, to_version_id)
) STRICT, WITHOUT ROWID;
```

Matching diagnostics (`outsideWidthM`, `widestDifferenceM`, `claimedDifferenceM`,
`match`) move to a sparse `crosswalk_edge_check` table, present only for
crosswalks that carry them. A new weighting basis is a new `weight_basis` row,
so "choose the weight to suit the measure" (see `services/api/DIRECTION.md`)
needs no schema change.

### 4. Statistics

A simplified data cube in the style of SDMX.

```sql
CREATE TABLE source (
  id          INTEGER PRIMARY KEY,
  publisher   TEXT NOT NULL,
  url         TEXT,
  licence     TEXT NOT NULL,
  licence_url TEXT,
  citation    TEXT
) STRICT;

CREATE TABLE dataset (
  id          INTEGER PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,  -- fuel-poverty
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  source_id   INTEGER NOT NULL REFERENCES source(id),
  released    TEXT,
  next_update TEXT,
  fingerprint TEXT NOT NULL          -- compiler and input hash
) STRICT;

CREATE TABLE measure (
  id             INTEGER PRIMARY KEY,
  slug           TEXT NOT NULL UNIQUE, -- crime-count, vote-share
  label          TEXT NOT NULL,
  description    TEXT NOT NULL,
  unit           TEXT NOT NULL,        -- people, households, percent, gbp, tonnes-co2e
  value_kind     TEXT NOT NULL CHECK (value_kind IN ('count','rate','share','median','mean','index','rank','amount','category')),
  aggregation    TEXT NOT NULL CHECK (aggregation IN ('sum','ratio','weighted_mean','none')),
  numerator_id   INTEGER REFERENCES measure(id),
  denominator_id INTEGER REFERENCES measure(id),
  weight_basis_id TEXT REFERENCES weight_basis(id)
) STRICT;

CREATE TABLE measure_alias (
  measure_id INTEGER NOT NULL REFERENCES measure(id),
  alias      TEXT NOT NULL UNIQUE,
  PRIMARY KEY (measure_id, alias)
) STRICT, WITHOUT ROWID;

CREATE TABLE dimension (
  id    INTEGER PRIMARY KEY,
  slug  TEXT NOT NULL UNIQUE,         -- party, crime-type, tenure, sex, age-band
  label TEXT NOT NULL
) STRICT;

CREATE TABLE dimension_member (
  id           INTEGER PRIMARY KEY,
  dimension_id INTEGER NOT NULL REFERENCES dimension(id),
  code         TEXT NOT NULL,         -- burglary, con, owned-outright
  label        TEXT NOT NULL,
  parent_id    INTEGER REFERENCES dimension_member(id),  -- burglary within total
  position     INTEGER NOT NULL,      -- publisher's order
  UNIQUE (dimension_id, code)
) STRICT;

CREATE TABLE period (
  id         INTEGER PRIMARY KEY,
  label      TEXT NOT NULL UNIQUE,    -- 2024, 2024-25, 2024-Q3, 2021-census
  kind       TEXT NOT NULL CHECK (kind IN ('year','financial_year','academic_year','quarter','month','date','range')),
  start_date TEXT NOT NULL,
  end_date   TEXT NOT NULL
) STRICT;

-- A series is one measure, one combination of dimension members, on one release.
CREATE TABLE series (
  id             INTEGER PRIMARY KEY,
  dataset_id     INTEGER NOT NULL REFERENCES dataset(id),
  measure_id     INTEGER NOT NULL REFERENCES measure(id),
  release_id     INTEGER NOT NULL REFERENCES boundary_release(id),
  method         TEXT NOT NULL CHECK (method IN ('published','converted','aggregated','modelled')),
  derived_from_id INTEGER REFERENCES series(id),
  crosswalk_id   INTEGER REFERENCES crosswalk(id),
  weight_basis_id TEXT REFERENCES weight_basis(id),
  key            TEXT NOT NULL UNIQUE, -- canonical "dataset/measure/release/dim=member;..." for lookup
  CHECK ((method = 'published') = (derived_from_id IS NULL))
) STRICT;

CREATE TABLE series_member (
  series_id    INTEGER NOT NULL REFERENCES series(id),
  dimension_id INTEGER NOT NULL REFERENCES dimension(id),
  member_id    INTEGER NOT NULL REFERENCES dimension_member(id),
  PRIMARY KEY (series_id, dimension_id)
) STRICT, WITHOUT ROWID;
CREATE INDEX series_member_member ON series_member (member_id, series_id);

CREATE TABLE status (
  id    INTEGER PRIMARY KEY,
  slug  TEXT NOT NULL UNIQUE,         -- observed, estimated, provisional, suppressed, not_applicable
  label TEXT NOT NULL
) STRICT;

CREATE TABLE observation (
  series_id       INTEGER NOT NULL REFERENCES series(id),
  area_version_id INTEGER NOT NULL REFERENCES area_version(id),
  period_id       INTEGER NOT NULL REFERENCES period(id),
  value           REAL,               -- null only when status says why
  status_id       INTEGER NOT NULL DEFAULT 1 REFERENCES status(id),
  lower           REAL,
  upper           REAL,
  category_id     INTEGER REFERENCES dimension_member(id), -- value_kind = 'category' only
  PRIMARY KEY (series_id, area_version_id, period_id)
) STRICT, WITHOUT ROWID;
CREATE INDEX observation_area ON observation (area_version_id, series_id, period_id);
```

How current data maps onto it:

| Current                                             | New                                                                               |
| --------------------------------------------------- | --------------------------------------------------------------------------------- |
| `crime-burglary`                                    | measure `crime-count`, `crime-type=burglary` (parent `total`)                     |
| `general-election-con-vote-share-constituency-2019` | measure `vote-share`, `party=con`, release constituency 2019, period `2019-12-12` |
| `ethnicity-african`                                 | measure `residents`, `ethnic-group=african`                                       |
| census TS054 cube (9 generated columns)             | 9 series of measure `households`, `tenure=*`                                      |
| fuel poverty rate                                   | measure `fuel-poverty-rate`, `ratio` of `fuel-poor-households` / `households`     |
| constituency winner                                 | measure `winning-party`, `value_kind = category`, `category_id` = party member    |
| IMD rank and decile                                 | measures `imd-rank` (`rank`, `none`) and `imd-decile` (`index`, `none`)           |

`value_kind` and `aggregation` let custom-area profiles rebuild a rate from
its numerator and denominator, or refuse with a reason, instead of averaging.
`method` and `derived_from_id` make "consistent time series on one release"
and "is this change real?" into ordinary rows with stated provenance.

Each observation row is three integers and a value in the common case, so
full census cubes at LSOA level stay affordable. Text never repeats per row.

#### Elections

Results with candidates need more than a cube:

```sql
CREATE TABLE election   (id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, kind TEXT NOT NULL, date TEXT NOT NULL, release_id INTEGER NOT NULL REFERENCES boundary_release(id), source_id INTEGER REFERENCES source(id)) STRICT;
CREATE TABLE contest    (id INTEGER PRIMARY KEY, election_id INTEGER NOT NULL REFERENCES election(id), area_version_id INTEGER NOT NULL REFERENCES area_version(id), seats INTEGER NOT NULL DEFAULT 1, electorate INTEGER, turnout INTEGER, UNIQUE (election_id, area_version_id)) STRICT;
CREATE TABLE candidacy  (contest_id INTEGER NOT NULL REFERENCES contest(id), position INTEGER NOT NULL, name TEXT, party_id INTEGER REFERENCES dimension_member(id), votes INTEGER, elected INTEGER NOT NULL CHECK (elected IN (0,1)), PRIMARY KEY (contest_id, position)) STRICT, WITHOUT ROWID;
```

Votes, vote share, turnout and winner are then built into `observation` from
these tables, so the generic readers and views see elections like any other
data. Notional results on new boundaries are `converted` or `modelled` series.

### 5. Postcodes (`atlas-postcodes.sqlite`)

```sql
CREATE TABLE postcode (
  id         INTEGER PRIMARY KEY,
  code       TEXT NOT NULL UNIQUE,   -- normalised, single space
  easting    INTEGER, northing INTEGER,
  quality    TEXT NOT NULL,
  nation_id  TEXT NOT NULL,
  introduced TEXT NOT NULL,          -- YYYY-MM
  terminated TEXT,                   -- null when live
  large_user INTEGER NOT NULL CHECK (large_user IN (0,1))
) STRICT;

CREATE TABLE postcode_area (
  postcode_id     INTEGER NOT NULL REFERENCES postcode(id),
  area_version_id INTEGER NOT NULL,  -- atlas.area_version(id), checked at build
  containment     TEXT NOT NULL CHECK (containment IN ('within','nearest','split')),
  distance_cm     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (postcode_id, area_version_id)
) STRICT, WITHOUT ROWID;
```

SQLite cannot enforce foreign keys across attached files, so the build checks
them explicitly. Postcode counts per area become observations of measure
`postcodes` with a `postcode-status` dimension.

### 6. Documentation

```sql
CREATE TABLE release_info (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
  -- schema_version, release_id, built_at, source_hashes, licence_summary

CREATE TABLE doc_table  (name TEXT PRIMARY KEY, layer TEXT NOT NULL, description TEXT NOT NULL) STRICT;
CREATE TABLE doc_column (table_name TEXT NOT NULL REFERENCES doc_table(name), column_name TEXT NOT NULL,
                         description TEXT NOT NULL, example TEXT, PRIMARY KEY (table_name, column_name)) STRICT;
CREATE TABLE doc_example (id INTEGER PRIMARY KEY, question TEXT NOT NULL, sql TEXT NOT NULL) STRICT;

CREATE VIRTUAL TABLE search USING fts5 (kind, slug, label, body, tokenize = 'porter unicode61');
  -- rows for datasets, measures, dimension members, areas, places
```

`doc_example` holds tested question and SQL pairs, drawn from the question bank
in `services/api/DIRECTION.md`. They double as a test suite: each runs at the
end of the build and must return rows.

A test asserts that every table and column has a `doc_column` row, so the
documentation cannot drift.

Readable views, for people and agents who should not need the joins:

```sql
CREATE VIEW v_area AS        -- area version with code, name, geography, release, validity, nation
CREATE VIEW v_area_current AS -- latest available version per area
CREATE VIEW v_area_history AS -- events per area with from/to codes and names
CREATE VIEW v_series AS      -- series with dataset, measure, unit, method, and members as "party=con; ..."
CREATE VIEW v_observation AS -- dataset, measure, unit, members, area code and name,
                             -- geography, release, period, value, status, method, licence
```

Example the file should answer without outside documentation:

```sql
SELECT period, value
FROM v_observation
WHERE measure = 'claimant-rate' AND area_code = 'E08000003'
  AND release = '2024-05-uk-bfc' ORDER BY period;
```

### 7. Cache (`atlas-cache.sqlite`)

Unchanged in role: everything here is rebuilt from the distributed files and
never read as truth. It gains the JSON payloads and website assets that now
sit in the canonical file. Exact-byte compatibility for existing URLs is
produced here, by a builder that reads rows and checks hashes against
`dataset.fingerprint` and the published manifest.

## Decisions

### Observation key: area version (step 1, 2026-10-27)

`observation` is keyed by `(series_id, area_version_id, period_id)`, not by
`area_id` with the release left to the series.

- **The foreign key proves the area existed in the release.** With `area_id`,
  an observation for a code that was abolished before the series' release
  would still satisfy its foreign key. With `area_version_id` it cannot be
  written.
- **Step 2 adopts it without rewriting rows.** Today's `areas` table already
  has one row per (release, code), so `areas.id` is an area version id in all
  but name. Step 1 points `observation.area_version_id` at `areas(id)`. Step 2
  creates `area_version` with `id = areas.id` (and `boundary_release.id =
area_releases.position`, which `series.release_id` already references), then
  repoints the foreign keys. Observation rows, their primary key and their
  index are unchanged.
- **Cross-release joins stay one join away.** "The same area in two releases"
  is `area_version.area_id`, so comparing series on different releases joins
  through `area_version` rather than needing a second key on every row. Width
  is the same either way: one integer.
- **The series still states its release.** `series.release_id` is kept,
  because a series is defined on one release and readers ask for "this measure
  on 2021 LSOAs" without touching observations. The build checks that every
  observation's area version belongs to its series' release, since SQLite
  cannot express that as a foreign key without widening the row.

### Step 1 scope

- New tables use the singular names in this document (`dataset`, `measure`,
  `series`, `observation`, ...). They sit beside the API's existing
  `observations` and `observation_*` tables, which step 4 retires.
- Until step 2, `area_version` means `areas` and `boundary_release` means
  `area_releases`. Foreign keys point there.
- Record order is not stored. Fuel poverty's records are in area code order,
  and the build refuses input that is not, so readers order by code.
- Publisher area names that differ from the boundary name go in
  `dataset_area_name (dataset_id, area_version_id, name)`, only where they
  differ. Step 2 can fold these into `area_name` rows of kind `publisher`.
- Dataset-specific response fields (fuel poverty's `id`, `year`,
  `boundaryYear`) are derived in the dataset's mapper from rows, not stored.
- Columns that need tables from later steps are left out for now:
  `series.crosswalk_id` and the `weight_basis_id` columns (step 3), and
  `dataset.next_update`. The whole database is rebuilt every run, so adding
  them later is a writer change, not a migration of existing rows.
- `observation` keeps `lower`, `upper` and `category_id` inline as above.
  Unused, each costs one header byte per row.
- The fuel poverty JSON payload stays in `payloads` until step 4 moves payloads
  to the cache, so other readers of `dataset:fuel-poverty` are unchanged.

### Step 2 scope (2026-10-28)

- `area_version` keeps the old `areas.id` values, so no observation,
  crosswalk or postcode row changes. Ids follow release order, then area
  artifact order, as before.
- `area` ids follow first appearance in release order. The unique key is
  `(code, geography_id)`, code first, so a lookup by code alone uses it.
- `areas` becomes a read-only view over `area_version` and `area` with the old
  column names, so current readers keep working. Writers (crosswalk endpoints
  and postcode areas that are missing from the inventory) insert through
  `addAreaVersion`, which also adds the `area` if it is new.
- Every foreign key that pointed at `areas(id)` now points at
  `area_version(id)`: observations, `dataset_area_name`, crosswalk endpoints
  and postcode area references.
- The build checks that each area version's release is for the same geography
  as its area.
- `geography` holds only `id` and `slug` for now. `label`, `kind` and
  `description` need a source of truth, which the documentation step adds.
- `boundary_release` is not split out yet. `area_version.release_id` and
  `series.release_id` still reference `area_releases(position)`, which is the
  id `boundary_release` will keep.
- Transitional columns stay on `area_version` until their new homes exist:
  `aliases` (JSON, to become `area_name` rows), `population` (to become an
  observation) and `in_inventory` (whether the release's inventory lists the
  code, rather than a crosswalk or postcode lookup naming it). `area.nation_id`,
  centroids and bounding boxes are left for step 5.
- `dataset_area_name` stays keyed by area version, since a publisher's name
  can differ by release.

### Step 3 scope (2026-10-28)

- `crosswalk_sources`, `crosswalk_targets`, `crosswalk_field_sets`,
  `crosswalk_label_exceptions` and `crosswalks` are replaced by `crosswalk`,
  `crosswalk_edge`, `weight_basis`, `crosswalk_weight`, `crosswalk_edge_check`,
  `crosswalk_source` and `crosswalk_label`. All 181 crosswalk artifacts rebuild
  from rows byte for byte. On the 2026-10-28 build the crosswalk tables went
  from 172 MB to 113 MB (problem 5's 890 MB predates earlier compaction).
- Order is not stored. Every built crosswalk already lists records in source
  code order and targets in target code order, so the build now refuses
  anything else, as fuel poverty does.
- Field order is stored once per crosswalk side (`source_fields`,
  `target_fields`), not per endpoint. A target lists its fields in that order,
  leaving out the ones it does not have. Every source in a crosswalk must give
  the same fields, because source `areaM2` and `population` are facts on the
  shared `area_version`.
- `relation` keeps the compiler's values (`within`, `straddles`,
  `indeterminate`) and is null where a method does not give one, rather than
  being mapped onto `equal`/`within`/`contains`/`overlaps`, which would lose
  `indeterminate`. Official lookups' `change` is an edge column too.
- `weight_basis` uses the compiler's vocabulary, `area` and `population`.
  `crosswalk_weight.weight` is the normalised per-source weight, `overlap` the
  amount in the basis unit, and `source_share`/`target_share` the overlap as a
  share of the whole source and target. Population-weighted crosswalks also
  record the overlap area, which goes to `crosswalk_edge_check.overlap_area_m2`.
- Extent-continuity shares are geometric checks, not weights, so they go to
  `crosswalk_edge_check` (`check_source_share`, `check_target_share`).
- `crosswalk_source` holds only sources with `coverage` or no targets (5,000
  of 1.9 million). Other sources are the distinct `from_version_id` of edges.
- Publisher labels are keyed by crosswalk and area version, stored only where
  they differ from `[name, ...aliases]`. No crosswalk relates a release to
  itself, so a version has one set of labels per crosswalk; the build refuses
  two.
- Kept for byte-for-byte rebuilds until readers build responses from rows:
  `header` (artifact metadata, not yet reduced to `provenance`), `bytes`,
  `artifact`, `content_hash`, the JSON `weighting`, and the field orders.
  `crosswalk_inventory` and `crosswalk_coverage` move to `release_info` later.
- `source_id` is left out until boundary releases and sources are linked.

### Step 4, batch 1: datasets served from rows (2026-10-28)

- A dataset is served from rows when its config sets `rebuild` (fuel poverty
  through its mapper). Its JSON is not stored in `payloads`; `datasets.payloadId`
  is null. `atlas-sqlite` and `build:cache` rebuild it into
  `atlas-cache.sqlite` (`dataset_payloads`, keyed by output and manifest hash),
  checking the hash. Readers take the stored payload, else the cached rebuild,
  else rebuild from rows and check the hash, so a missing cache is slower, not
  wrong.
- The website and API run from one checkout, and the server rebuilds the cache
  from `atlas.sqlite` alone, so the rows must hold everything in the JSON.
  What the observation tables do not hold is in two small layout tables:
  `dataset_part` (each top-level key and its header JSON) and `dataset_leaf`
  (each leaf of a record, in key order: a series value or bound, the code, the
  name, a derived rule or a literal). They are inferred from the first record
  of each part, so no config describes the JSON shape. They are response
  layout, kept until readers build responses from rows (step 7).
- Records are laid out in area code order; order is not stored (batch 2
  stores it, below). A leaf names
  the first record's series; records on an `alsoIn` release read the series
  with the same measure and members.
- Derived numbers stay unstored. A config's `rebuild.derived` gives one rule
  per `derived` pattern, the compiler's own expression, applied in order to the
  rebuilt record (good health is `veryGood + good`, then a percentage of it).
- The build refuses a served dataset whose rows do not rebuild the compiled
  JSON byte for byte, and reports where the bytes first differ.
- Batch 1 is the datasets that already rebuild: fuel poverty, general health
  and housing tenure (census cubes), land area, air quality, constituency
  population, regional GDP at ITL1 to ITL3, and both life expectancy datasets.
  On the 2026-10-28 build stored payload JSON went from 79 MB to 58 MB and
  `atlas.sqlite` from 453 MB to 432 MB; the layout tables hold 537 leaves.
  Observation rows are unchanged.

### Step 4, batch 2: record order (2026-10-28)

- Most datasets keep their records in the publisher's file order, which no sort
  reproduces. Sorting in the compilers would change every hash and URL, so the
  order is stored instead: `dataset_record` holds each record's area version
  by position, for every record set of a served dataset. It also makes the
  record list explicit rather than whatever observations exist.
- No unique index on the area: a duplicate would already fail the byte check,
  and the index doubled the table.
- Batch 2 adds the 15 datasets whose only blocker was order: car availability,
  qualification, travel to work, ethnicity, council tax, local government
  finance, housing affordability, broadband, mobile coverage, road collisions,
  homelessness, both adult social care, net additional dwellings and planning
  applications. 26 datasets are now served from rows. On the 2026-10-28 build
  stored payload JSON went from 58 MB to 52 MB; `dataset_record` holds 147k
  rows in 2.9 MB.

### Step 4, batch 3: parent areas (2026-10-28)

- A record that names the area it lies in (an LSOA's district) stores that
  area, not the strings. A config's `parents` lists the code and name fields
  and the releases the codes are on, tried in order. `dataset_record_parent`
  holds one area version per record and parent; a publisher name that differs
  from the boundary name goes in `dataset_area_name` as for records. Leaves
  `parent_code` and `parent_name` point at a parent by its index in `parents`,
  not by geography, because one field can hold areas of two geographies
  (Brexit's `regionCode` is a region in England and a country elsewhere).
- These are the publisher's assertions, kept per dataset. Where a membership
  crosswalk agrees, a later step could read parents from it instead.
- Batch 3 adds the IMD, WIMD and NIMDM, with their districts on the 2024
  release. 29 datasets are now served from rows. On the 2026-10-28 build
  stored payload JSON went from 52 MB to 40 MB and `atlas.sqlite` from 429 MB
  to 418 MB; `dataset_record_parent` holds 37k rows in 0.7 MB.

### Step 4, batch 4: null values and absent keys (2026-10-28)

- The layout is inferred from every record of a part, not the first. Leaf paths
  are merged into one key order every record agrees with (the build refuses
  records that order keys differently); a value leaf takes its series from the
  first record with a number there.
- A value leaf with no observation is written as null, so nulls need no rows.
  A leaf a record leaves out entirely is a `dataset_record_absent` row
  (dataset, part, record set, record position, leaf position). Absence is
  sparse; 21 rows on the 2026-10-28 build.
- A record may leave out a parent (crime's five districts with no community
  safety partnership).
- Batch 4 adds crime (police force area and community safety partnership as
  parents) and public health. 31 datasets are served from rows; stored
  payload JSON is 40 MB.

### Step 4, batch 5: records for areas the atlas lacks (2026-10-29)

- The pay and referendum files carried records for areas the atlas has no
  boundary for: metropolitan counties (E11) and Inner and Outer London (E13)
  in income and workplace income, and Gibraltar in Brexit. Configs excluded
  them, so rows could not rebuild the files. The compilers now drop them
  instead, which changes those three hashes; the excludes are gone, so the
  build fails if such codes come back.
- Brexit names its region as a parent, on the region release and then the
  country release (Scotland, Wales and Northern Ireland).
- Batch 5 adds income, workplace income and Brexit. 34 datasets are served
  from rows; stored payload JSON is 39 MB.

### Step 4, batch 6: derived rules (2026-10-29)

- A derived rule gets the path of the leaf it fills as well as the record, so
  one rule can serve a pattern that matches a leaf in every period, and it may
  give null, as the compilers do.
- Claimant count stores `totalRate` as `claimant-rate`. It is published,
  except for the authorities formed in 2023, where the compiler divides by
  the 2024 mid-year population; the stored value is what the file serves.
  `youthRate` is derived from it.
- Child poverty derives `childrenPopulation` and pupil absence its `value`.
  The school tables derive their top-level copies from the latest year in
  `series`, and the disadvantage table its yearly `att8Gap`, with the
  compiler's six-pupil floor.
- The school compilers now drop the joint district the publisher reports as
  one (`E07000010 / E07000009`), which has no boundary. This changes both
  hashes, and the config's exclude is gone.
- Batch 6 adds claimant count, child poverty, pupil absence and the three
  school performance tables. 40 datasets are served from rows; stored
  payload JSON is 38 MB.

### Step 4, batch 7: values in arrays (2026-10-29)

- A record node that is an array is walked like an object. Its leaves store
  the index as a number in `dataset_leaf.path` (`["total",0]`), so the
  rebuild knows to make an array. An empty array stays a literal.
- A parent can be named by code only. House prices use this for
  `sourceWardCode`, the code Salford's redrawn wards were published under,
  on the 2020 ward release.
- Ward population and house prices declare their district parent.
- The UK population compiler drops `country`, the first letter of the code,
  which nothing read. This changes its hash.
- Batch 7 adds population, UK population and house prices. 43 datasets are
  served from rows; stored payload JSON is 30 MB.

### Step 4, batch 8: derived from another dataset (2026-10-29)

- A derived rule also gets the record's area code, its part's header and
  `dataset(slug)`, another dataset's compiled JSON rebuilt from its rows
  (once per database). Rules run only after every row is written.
- The per-100k figures divide by the area's total in UK population: the
  part's year for electricity, gas and jobs, 2024 for waste, EV chargers and
  business activity. The rule sums the ages in the compiler's order, so the
  bytes match.
- GHG emissions stores the publisher's `populationThousands` as
  `ghg-population` and derives `perPersonTCO2e` from it.
- Batch 8 adds GHG emissions, gas, electricity, EV chargers, waste, jobs and
  business activity. 50 datasets are served from rows; stored payload JSON is
  15 MB.

### Step 4, batch 9: SIMD council areas (2026-10-29)

- The SIMD loader coded council areas from a table keyed by name. It missed
  Na h-Eileanan an Iar (the indicators file uses the Gaelic name), leaving 36
  data zones with an empty code, and gave Fife, Perth and Kinross, Glasgow
  and North Lanarkshire their codes from before 2018, which no listed release
  has. It now takes each data zone's code from the published lookup's
  `LAcode`. This changes SIMD's hash.
- SIMD declares its council area parent. 51 datasets are served from rows.

### Step 4, batch 10: predecessor lists and status fields (2026-10-29)

- A parent's code is a path into the record, so a list of codes is one
  parent per index. Unemployment's four unitaries formed in 2023 list the
  districts their figures were built from (`derivedFromPredecessors`); each
  is a parent on the 2021 district release.
- A field's `status` names the record path holding the value's status and
  the JSON written there for each one. Its `status` leaf writes that JSON
  back from the observation's stored status, so the flag needs no rows of
  its own. Brexit by constituency's `isKnownResult` is `true` when observed
  and `false` when estimated.
- Batch 10 adds unemployment and Brexit by constituency. 53 datasets are
  served from rows; stored payload JSON is 13 MB.

### Step 4, batch 11: NHS waiting times (2026-10-29)

- The March 2026 waiting times are on the 42 integrated care boards in force
  from 2023 until the April 2026 reorganisation. The atlas held only the April
  2026 boards, so it now also holds the April 2023 release (held from the map;
  the ONS published no boundaries for 2024 or 2025, and the 2023 codes and
  names match the April 2025 lookup exactly).
- The file keys boards by NHS organisation code (`QE1`). A config's `keys`
  maps each to its area's code, and `dataset_area_key` stores the key per
  dataset and area version, as `dataset_area_name` stores names, so rows
  rebuild it.
- Batch 11 adds NHS waiting times: incomplete pathways and those over 18
  weeks, with the share over 18 weeks derived. 54 datasets are served from
  rows.

### Step 4, batch 12: local elections and the election tables (2026-10-29)

- Each part of an election dataset is an `election` row (kind, polling day,
  release) and each record a `contest` on its area. What a publisher says
  about a contest beside its votes is contest text, stored as published: the
  area's name at that election, the authority holding it (`ladCode` is a
  district, a county or `Unknown`, depending on the source) and, for general
  elections, the result and the elected candidate (`candidacy`). Leaves
  `contest` and `candidacy` name the column they rebuild. Votes, electorate
  and turnout are observations whose period is the polling day.
- A dataset's releases name its true year. A listed year the atlas holds no
  release for is skipped, so records sit on the nearest listed release until
  the true one is added, then move to it with no config change. `alsoIn` can
  depend on the part: local elections try the releases nearest each polling
  day first.
- The atlas holds the May 2025 county electoral divisions and the May 2017
  ones, published as names and codes only (features with no geometry). Both
  are held from the map.
- The compiler corrects four Huntingdonshire ward codes LEAP gives in 2016
  and 2017 that no ward ever had, and lists party votes in the party list's
  order rather than the source's. Records' key orders are merged
  topologically, so records that each show some of the parties agree on one
  order. These change the local elections hash.
- Before 2021 the source (LEAP) publishes no electorate or turnout; the
  compiler writes 0 and the rebuild derives it. `totalVotes` is derived as
  the sum of the party votes.
- Batch 12 adds local elections: 9 elections and 28,840 contests. 55
  datasets are served from rows.

### Step 4, batch 13: general elections (2026-10-30)

- Each constituency's region, country, type, result and first and second
  parties are contest text, and its MP the elected `candidacy` (given name,
  family name, gender). Party votes, electorate, valid votes, rejected
  ballots and majority are observations; turnout is derived with the
  compiler's own function.
- Each election names its own year's constituency release. The header gives
  2019 for 2010 to 2019, the last year of that boundary set; the atlas pins
  2010 and 2015 to the December 2017 release, which has the same codes.
- Batch 13 adds general elections: 5 elections and 3,250 contests. 56
  datasets are served from rows.

What keeps the other datasets on payloads, found by forcing `rebuild` on each
(the first blocker the build hit; a dataset can have more):

| Blocker            | Datasets                            |
| ------------------ | ----------------------------------- |
| Not stored as rows | historical general elections (#488) |

### Catalogue datasets as configuration (2026-10-27)

Every catalogue dataset whose records are numbers keyed by area code is stored
from a `DeclaredDataset` in `packages/atlas-runtime/src/catalogue/statisticsDatasets/`, read by
`packages/atlas-runtime/src/catalogue/declaredStatistics.ts`. There is no per-dataset code.

- **Value equivalence, not byte equivalence.** The compiled JSON stays the
  bytes the website and API serve (and is hashed), so these rows are checked
  by value: every number in every record must be claimed by a field, as a
  value or an interval bound, or listed under `derived` with a reason, and the
  build checks the stored row count. A new compiler field fails the build
  instead of going missing. Datasets with `rebuild` are also checked byte for
  byte and served from rows (step 4, above).
- **Derived values are not stored.** Per-100k figures, percentages a
  compiler computes from stored counts, and copies (the latest school year
  repeated at the top of each record) are listed as `derived`. Published
  rates are stored.
- **Codes go where they exist.** Compilers label a dataset with one boundary
  year, but many mix releases: census 2021 district tables include the 2023
  unitaries, pay tables include England, regions and counties, and older
  series keep abolished districts. Each code is placed on the header's
  release, then each `alsoIn` release in turn, so every row's foreign key is
  true. A code in no listed release fails the build unless an `exclude`
  pattern gives a reason (joint district codes).
- **Period labels have one meaning.** `periods` in `declaredStatistics.ts`
  builds them: `2024` (calendar year), `2024-25` (April to March), `2024/25`
  (school year), `2026-Q1`, `2025-07`, `2026-07-01`, `2022-2024` (whole
  years), `year-ending-2026-03`, `2021-census`.
- **Datasets are read twice, one at a time.** The first pass plans series and
  checks coverage; the second streams observations. No parsed JSON is held
  between them, so the build's memory stays near one dataset.
- **Every manifest type is accounted for.** The build refuses a dataset that
  is neither configured nor in `UNSTORED_DATASETS` with a reason.

Not stored yet:

| Dataset                       | Why                                                                                     |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| `general-election`            | Candidates, parties and winners need the election tables.                               |
| `local-election`              | The election tables, and several years use county division codes outside ward releases. |
| `historical-general-election` | Results before 2010 are on constituency boundaries with no atlas release.               |
| `nhs-waiting`                 | Integrated care boards are keyed by NHS organisation codes, not GSS codes.              |

Shapes that did fit, with a dimension: single-year age arrays (`age`, 0 to
90-plus, with `sex`), nested census categories (`ethnic-group` with parents),
year-keyed series inside records (`{period}` bindings), arrays indexed by year
(house prices), and published confidence intervals (`lower` and `upper`).
Intervals published as a half-width (modelled unemployment) are their own
measure, because turning them into bounds would compute new values.

## How to port a dataset

Most datasets are configuration: add a `DeclaredDataset` to
`packages/atlas-runtime/src/catalogue/statisticsDatasets/` and list it in `STATISTICS_DATASETS`. The schema
and the writer do not change.

1. **Fields.** Each field is a path into a record (`breakdown.{tenure}`,
   `series.{period}.avgAtt8`, `{sex}.value`) with the measure it holds. A
   `{dimension}` segment binds a key to a member; `{period}` binds it to a
   period. Fixed `members` label the rest.
2. **Measures and dimensions** follow the rules below. Shared measures live
   in `statisticsDatasets/measures.ts`.
3. **Periods.** `period` maps the top-level key, and a field's `period` maps
   its `{period}` key, to one of the `periods` constructors.
4. **Releases.** The header's `boundaryType` and `boundaryYear` by default;
   `release` overrides it and `alsoIn` lists fallbacks. `exclude` drops codes
   with a reason.
5. **Derived numbers** go in `derived` with why.
6. **Serve from rows** by setting `rebuild`, with a rule for each derived
   pattern that repeats the compiler's expression. The build fails, showing
   the first differing bytes, until the rows rebuild the JSON exactly.
7. **Check** with the real data: the build fails on any unclaimed number or
   unplaced code. Add a fixture test in `tests/server/declaredStatistics.test.ts`
   for any new kind of shape.

A dataset that needs code (a byte-exact rebuild, or a shape configuration
cannot describe) writes a mapper instead, a function that returns a
`StatisticsDataset` (`packages/atlas-runtime/src/catalogue/atlasStatistics.ts`).
`packages/atlas-runtime/src/catalogue/fuelPovertyStatistics.ts` is the worked example.

1. **Declare measures.** One per quantity, not per breakdown: `crime-count`,
   not `crime-burglary`. Reuse an existing slug when the meaning is the same
   (`households`, `residents`); the build refuses two different declarations
   of one slug. Set `valueKind` and `aggregation` honestly, and give `ratio`
   measures their numerator and denominator.
2. **Declare dimensions** for whatever the old measure ids encoded: party,
   crime type, tenure, ethnic group. Members are listed in the publisher's
   order, with `parent` for totals and subtotals.
3. **Declare periods** with their kind and dates (`2024`, `2024-25`,
   `2021-census`).
4. **Declare series**: each combination of measure, members and boundary
   release (`{ geography, id }` from `area_releases`). A census cube with nine
   tenure columns is nine series of `households`. Derived series set `method`
   and `derivedFrom`.
5. **Yield observations** as `{ series, code, period, value }`. Use `status`
   instead of inventing values (`suppressed` with `value: null`), `lower` and
   `upper` for intervals, and `category` for categorical measures (with
   `categoryDimension` set). Unknown codes fail the build.
6. **Yield publisher area names** only if the old output used them.
7. **Rebuild the old output** from rows in a reader beside the mapper, and
   call it from `verify` so the build refuses to publish different bytes. Add
   the dataset to the list passed to `statisticsTables` in
   `pipeline/src/buildAtlasSqlite.ts`, and point its reader at the rebuild.
8. **Test** with a small fixture in `tests/server/` and the real data in
   `tests/built/`, as `atlasStatistics.test.ts` does.

Order is not stored. If the old output's order is not derivable from codes or
member positions, sort it in the compiler first (in a separate change that
updates its hash), rather than adding a position column.

Shapes that do not fit a cube (candidates and ballots) use the election tables
and then feed `observation` like any other series.

## Current tables and their new home

| Current table                                                 | New home                                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `meta`                                                        | `release_info`                                                            |
| `area_inventory`                                              | `release_info` (hashes)                                                   |
| `area_releases`                                               | `boundary_release`                                                        |
| `areas`                                                       | `area` + `area_version` + `area_name`                                     |
| `crosswalk_inventory`, `crosswalk_coverage`                   | `release_info`; coverage becomes a view over `crosswalk_edge`             |
| `crosswalks`                                                  | `crosswalk` (`header` reduced to `provenance`)                            |
| `crosswalk_sources`                                           | dropped; source area values become observations or `area_version` columns |
| `crosswalk_targets`                                           | `crosswalk_edge` + `crosswalk_weight` + sparse `crosswalk_edge_check`     |
| `named_location_inventory`                                    | `release_info`                                                            |
| `named_locations`                                             | `place`                                                                   |
| `named_location_members`, `_assertions`, `_partial_members`   | `place_member`                                                            |
| `named_location_geometries`                                   | `atlas-geometry.gpkg`                                                     |
| `location_projection_*`                                       | cache (derived from `place_member` and crosswalks)                        |
| `payloads` (datasets)                                         | rows in layer 4; JSON rebuilt into cache                                  |
| `payloads` (terrain, geography catalogues)                    | cache, or relational where they hold facts (boundary releases)            |
| `datasets`                                                    | `dataset` + `source`                                                      |
| `observation_artifacts`, `observation_*`                      | layer 4                                                                   |
| `catalogue_measures`, `_periods`, `_records`, `_observations` | layer 4                                                                   |
| `observation_catalogue`                                       | `release_info`                                                            |
| `place_index_*`, `area_search_*`                              | cache; `search` FTS5 covers simple lookups in the canonical file          |
| `postcodes`                                                   | `atlas-postcodes.sqlite` `postcode`                                       |
| `postcode_area_*`, `postcode_area_shards`                     | `postcode_area`                                                           |
| `postcode_counts`                                             | observations                                                              |
| `website_assets`                                              | cache                                                                     |

## Migration

Each step lands separately, keeps the current readers working, and proves
itself by comparing rebuilt output with the existing JSON byte for byte, as the
fuel poverty pilot does.

1. **Agree the observation model** (layer 4) before more datasets join the
   pilot. Port fuel poverty from `catalogue_*` onto it, keeping its URL and
   hash. This stops the three observation models from drifting further.
2. **Area identity.** Add `area` and `area_version` beside `areas`, then move
   foreign keys onto `area_version.id`. Everything else references it.
3. **Crosswalks as integer edges and weights.** Compare against the
   experiments in `.data-release/sqlite-analysis/`.
4. **Datasets to rows in batches**, starting with ones the API already holds
   as `observation_*` rows (census cubes, crime, ethnicity), then elections.
   Each batch moves its payload JSON into the cache.
5. **Places, postcodes, geometry file.**
6. **Documentation tables, views, FTS and `doc_example` tests.** Some of this
   can start at step 1, since every new table needs `doc_column` rows.
7. **Remove the old tables** once no reader uses them.

## Open questions

- **Observation key.** Resolved: area version. See [Decisions](#decisions).
- **Geometry size.** Measure a simplified layer for all 104 releases before
  committing to shipping `atlas-geometry.gpkg`.
- **Postcode licensing.** Confirm the ONSPD and Code-Point Open terms allow
  redistribution as a separate file in this form.
- **Period granularity.** Resolved: elections use the polling day.
- **Should the core file be built with DuckDB** (see Foundations in
  `services/api/DIRECTION.md`) and exported to SQLite? The schema is the same
  either way.
