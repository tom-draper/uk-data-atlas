# Canonical SQLite schema design

`atlas.sqlite` stores geography and catalogue statistics as relational rows.
`atlas-cache.sqlite` holds derived search, projection and dataset payload
caches. See `data/build/README.md` for the tables, keys and build stages.

## File identity and provenance

Published atlas and module SQLite files have `application_id` 0x554b4441
(ASCII UKDA) and `user_version` equal to `meta.schemaVersion` (currently 3).
Bump the schema version when the published SQLite schema changes. Internal
cache files do not carry this identity. Inspect both header values with
`sqlite3 atlas.sqlite 'PRAGMA application_id; PRAGMA user_version;'`.
Readers accept the legacy zero application id and reject other unknown ids.
`file` needs a locally installed magic entry to identify these files by name.
Add this under its SQLite rule; the ID is not registered upstream:

```text
>68 belong =0x554b4441 UK Data Atlas SQLite database -
```

`meta.schemaVersion` records the schema version. `buildId` is a SHA-256 of
an intermediate assembled database and its provenance, before final publication.
It identifies the assembly without hashing the file that contains the hash.
`dataRelease` contains the pinned `data-release.json` when present. `gitCommit`
and `gitDirty` are present when the repository and Git are available. Dirty
includes tracked changes and non-ignored untracked files, but not ignored files.
The build ID also reflects assembled content from ignored inputs.

`buildTimestamp` is the UTC time supplied through `SOURCE_DATE_EPOCH`, in Unix
seconds. It is omitted when that variable is absent; it is not inferred from a
commit date or the wall clock. Identical assembly inputs and provenance therefore
produce identical published bytes. These values are recorded at assembly and do
not enter stage cache keys. A skipped assembly retains the provenance of the
file it produced, even if the current checkout or environment has changed.
When a fresh publication timestamp is required, supply `SOURCE_DATE_EPOCH` and
run assembly again.

Source edition information is already in `boundary_release.reference_year` and
`reference_month`, `boundary_release_edition`, and `dataset.released` where
known. The atlas does not assert dates that the sources do not provide. Module
files repeat provenance in `module_info`; assembled files retain core `meta`.
The release and module manifests hold SHA-256 hashes of the finished files.

## Stable ids

Integer ids are assigned once from registries committed in `pipeline/ids/`
and are not positions in any list. The natural key of each is unique, and
order is stored in `inventory_position`. See `docs/stable-ids.md`.

## Statistics model

`source` and `dataset` describe publication and provenance. `measure`,
`dimension` and `dimension_member` describe what is measured. A `series`
binds a dataset, measure, geography release and dimension members. Each
`observation` binds a series to an area version and period, with its value,
status and any bounds or category. `v_observation` joins these tables into a
readable view.

`observation` is `WITHOUT ROWID` with primary key `(series_id, area_version_id,
period_id)` and no secondary index. A secondary `(area_version_id, series_id,
period_id)` index cost about 115 MiB and saved almost nothing: on a copy of the
build, reading one area through the primary key took 0.1 to 4 ms warm (up to
0.06 ms slower than the index on small reads) and 8 to 165 ms cold (within about
1.7x of the index). A reader that looks an area up
passes the series of the area's release, as in `WHERE series_id IN (SELECT id
FROM series WHERE release_id = ?) AND area_version_id = ?`. A query on
`area_version_id` alone scans the table.

The statistics writer is `packages/measures/src/atlasStatistics.ts`.
Dataset declarations in
`packages/measures/src/statisticsDatasets/` identify fields,
dimensions and derived values. The build checks that numeric fields are
accounted for and validates the stored row counts.

`area_relationship` records how a publisher relates one area to another, for
a dataset: `parent` is the area that contains it, `predecessor` an area it was
formed from, `published-as` the area under whose code the publisher listed it,
and `coterminous` an area the publisher says has the same extent. A
publisher's mapping of one kind of area to another, such as local authorities
to NHS boards, is stored the same way. Each row names its dataset, so the source and licence are known, the
period the publisher states it for, and its two area versions, so the releases
are known. It is separate from the
crosswalks, which are computed from boundaries and weights.

`election`, `contest` and `candidacy` hold what election results carry beyond
their observations. An `election` names its dataset, the publisher's label for
it (`2024`, `1974O`), its kind (`general` or `local`), its polling day and the
release its areas are on. A `contest` is one area's contest at an election, with
the publisher's text: area name, constituency type and result. A dataset can
declare that `region` and `country` name areas. A name that is exactly one
area's name in the nearest available release of that geography (the later on a
tie) is stored as that `area_version`, in `region_area_version_id` or
`country_area_version_id`, and its text is not kept. Any other name is kept as
the publisher's text in `region_text` or `country_text`, so no published
spelling is lost: for the general elections these are the Scotland, Wales and
Northern Ireland labels in the region column (the region release is England
only) and 2010 and 2015's `East of England ` with a trailing space. The
historical elections' regions are the House of Commons Library's own and are
all kept as text. `v_contest` gives `region` and `country` as either.
Its two leading parties and the party declared the winner are `party` ids. A
`party` is one row whichever way it is written: `code` is the publisher's
abbreviation (`Lab`) and `key` the atlas's key for it (`LAB`, the abbreviation
in upper case). A winner with no abbreviation, such as `OTHER`, is stored under
its key. `name` and `colour` come from the dataset's declaration; a party it
does not name has its code as its name. `result` is kept as published (`Lab
gain from Con`) and not parsed, because nothing reads a part of it. `v_contest`
reads a contest back with the party codes and winner key. `candidacy` holds the
candidate a contest elected, and has no votes, party or share of its own.
Votes, electorates and turnout are observations dated on the polling day, and
are the only place they are stored:

| Dataset                       | Measure                     | Members                     | Areas            |
| ----------------------------- | --------------------------- | --------------------------- | ---------------- |
| `general-election`            | `party-votes`               | `party` = key in lower case | constituency     |
| `general-election`            | `valid-votes`, `electorate` |                             | constituency     |
| `local-election`              | `party-votes`               | `party` = key in lower case | ward or division |
| `historical-general-election` | `party-votes`               | `party-group` = a group     | constituency     |
| `historical-general-election` | `party-vote-share`          | `party-group` = a group     | constituency     |

Only the historical elections publish a share. `v_candidacy` joins each
candidacy to its party and that party's `party-votes` observation in the
contest, and gives the share as `100 * party_votes / valid_votes`, computed and
not stored. These are party figures: where a party stands one candidate, as in
the general elections, they are the candidate's. A party with no `party-votes`
series has null votes and share: in the built data, independents, the Speaker
and the TUV (15 of 3,250 candidacies).

The build refuses to publish if a contest's winner differs from its
`source-winning-party` observation.

## API measures and dimensions

Each catalogue measure carries a series identity: a statistics measure and
dimension members. A dataset ID disambiguates measures published by more than
one dataset. The computed measures and default members are in
`packages/measures/src/computedMeasures.ts`. The `statistics-vocabulary` stage derives
labels, parents and ordering from the statistics tables.

`data/build/statistics-read-path.json` is a build intermediate that maps each
observation artifact to a statistics selector and records the catalogue hash.
Assembly stores those selectors in the `statistics_selector` tables. A selector specifies a
dataset, measure, dimensions and geography. It can also sum dimensions, map
served area codes, derive ratios and totals, calculate confidence bounds, read
contest winners or construct a shared census table. The runtime validates the
selector inventory and catalogue hash before reading observations.

The `statistics-read-path` stage derives selectors from the catalogue,
statistics registry and declared rules. Fixture tests cover the selection
rules; observation artifacts are generated from the rows.

## Dataset payloads

The website still reads a JSON payload per dataset. It is generated from the
rows by `packages/measures/src/declaredPayload.ts`, using each
dataset's declaration: its field paths place series values in records, its
`payload` gives each part's header and the field holding the area code, and its
`computed` rules supply numbers the compiler calculates. The build compares
every generated payload with its independent compiled dataset by value,
including area identities, periods, values, statuses, bounds and derived fields,
and fails on any difference. The cache holds the generated payloads with their
hashes, so the website's immutable URLs identify the content they serve.

Facts that are not observations have a home in the tables above. A publisher's
parent areas and crosswalks are `area_relationship` rows; election text and
winners are `contest` and `candidacy` rows; names and keys are
`dataset_area_name` and `dataset_area_key`. A key that is a published external
code, such as an NHS ODS code, is also an `area_identifier` row, a documented
reference table. Figures that are aggregates of
observations, such as a referendum's winning answer, a district's deprivation
summary or an area's largest ethnic group, are computed when the payload is
generated and stored nowhere. Fixed text, such as a table's source note, sits
in the dataset's declaration.

## Reading a source straight into rows

A dataset normally compiles its source to a JSON payload, and the rows are
written from that JSON. A dataset can instead declare `statistics.direct`, a
reader that returns the rows from the source itself (`DirectPart[]`: for each
payload part, each area's code, name and values with their measure and
members). The `atlas-sqlite` stage reads these first (`readDirectParts`), then
`directStatistics` plans the series and `statisticsTables` writes them: the
assembly (`assembleStatistics`) and the writer are the ones a compiled dataset
uses.

A direct dataset either keeps its compiler or, with `direct.only`, has none.
With a compiler, the manifest's hash, summary and inputs come from it, and the
build compares the payload generated from the rows with its JSON, which proves
the reader and the compiler agree. `land-area` is migrated this way.

With `direct.only` there is no JSON. The declaration's `load` is
`noCompiledPayload()`, which keeps its generated type and throws if called.
The `datasets` stage (`compileDirectDataset`) reads the source once with a
tracked reader and writes the manifest entry from the parts: `inputs` from the
files read, `summary` from the same validation a compiled dataset gets, and
`compiled.sha256` and `bytes` as the hash and size of the serialised parts
(`directDigest`). The entry has `direct: true`, so `atlas-sqlite`,
`verify-dataset-payloads`, `scripts/verify-data.mts` and
`scripts/verify-atlas-datasets.mts` skip the file. `readDirectParts` refuses to
run if the sources no longer hash to the entry. What the compiled JSON used to
prove is held by a committed golden: `pipeline/src/checks/directPayloadGoldens.json`
has the hash and size the payload generated from the rows must have. It was the
hash of the compiler's last output, so the rows rebuild that JSON exactly.
Change it only when the payload is meant to change. `fuel-poverty` is migrated
this way, and its compiler is deleted.

`pipeline/tests/built/directStatistics.test.ts` writes each migrated dataset by
both paths onto the real area tables and compares them by natural key, not id:
observations (values, bounds, status, periods, members, area codes and names,
releases), series, dimension members with their parents and positions, and
dataset area names. It then rebuilds the JSON from the direct rows and
compares it with the compiled JSON. It covers datasets that keep a compiler; a
`direct.only` dataset is held to its golden by the dataset payload check. `tests/server/directStatistics.test.ts`
covers what a declaration rejects.

To port the next dataset:

1. Declare `direct.read(reader)` beside `load`. Read the same files as `load`
   (`readDirectParts` fails if it reads another, so the `datasets` stage's
   fingerprint of them still covers it). Share the source layout (sheet,
   columns) with the loader, but redo the cleaning, such as `parseNum` or a
   finite-number filter, so the test compares two readings of the file.
   Emit one `DirectValue` per stored number, naming its measure and members as
   a `fields` entry does, in the order `load` writes its record.
2. Leave `fields`, `dimensions`, `name`, `release` and `payload` as they are.
   A value that fits none of the declared fields, or names a measure or
   member the declaration lacks, fails the build.
3. Run `directStatistics.test.ts` and the dataset payload check.
4. To delete the compiler, add `only: true`, set `load` to
   `noCompiledPayload<T>()`, move the source path and table options into a
   module the reader imports, and add the hash and size of the old compiled
   JSON to `directPayloadGoldens.json`.

What fits: one table of areas read into one measure set, with static `fields`,
declared dimension members, one release, no parents, keys, relationships or
election text. That is the single-table loaders. What does not fit:
compilers that join sources, that derive values the rows then store (the
reader would repeat the compiler), that take their members or parents from the
data (the planner finds them in the compiled JSON), or that carry elections,
relationships or keys. `directStatistics` refuses those declarations. A part
is an array, so a dataset with millions of records needs `read` to yield
instead.

The compiled JSON of a dataset that keeps a compiler is not yet a pure output
of the rows. The manifest records its hash and size, its summary and its
inputs before any row exists, and `scripts/verify-data.mts`,
`scripts/verify-atlas-datasets.mts` and `compile-website-data` still read the
files. A dataset with `direct.only` avoids this by writing the manifest entry
from its parts, so port a dataset with that in view: once its reader replaces
the compiler, delete the compiler, record its last output's hash as the golden
and set `direct.only`.

## Compressed columns

Two columns hold whole documents rather than relational values, so they are
stored as Brotli blobs and decompressed on read.

- `payload.payload` in `atlas-build.sqlite` is `BLOB NOT NULL`: the exact UTF-8 JSON text, Brotli
  quality 9. Write it with `packText` and read it with `unpackText`
  (`packages/atlas-db/src/storedPayload.ts`). Never read the
  column with `String(value)`, which turns a blob into a list of byte values.
  `unpackText` returns text unchanged, so older databases and fixtures that
  store plain text still read. Hashes and ETags are taken over the
  decompressed text. Only the build metadata file stores payloads this way. The
  `payloads` tables of `atlas-cache.sqlite` and the postcode component remain
  plain text.
- `place_geometry.geometry` is `BLOB NOT NULL`: a GeoJSON geometry
  in WGS84 degrees rounded to five decimal places (about 1.1 m), Brotli
  quality 10. Write it with `packGeometry`, which also returns bounds measured
  from the rounded shape for `min_x`, `min_y`, `max_x` and `max_y`, and read it with
  `unpackGeometry` (`storedGeometry.ts`). Rounding is lossy: the stored shape
  differs from the compiled union by at most 0.000005 degrees per axis. Keep
  full precision geometry out of this table, and compute from the JSON
  artifacts, not from this column.

## Dataset declarations

To add a dataset, declare its fields and dimensions in
`packages/measures/src/statisticsDatasets/`. Each numeric field
must map to a series value or bound, or be documented as derived. Use the
dataset's own periods and geography, and declare alternate releases when
records contain areas from more than one release. Add unit tests for the
declaration, and give it a `payload`. Run the built statistics and dataset
payload tests after a data build.

## A self-describing file

`atlas.sqlite` explains itself, so a reader with only the file (a person in a
SQLite shell, a script or a language model) can find what it holds without
this repository. `assemble-atlas` writes these tables last, after every other
table exists:

- `schema_guide`: a few topics on how the file fits together.
- `schema_table`: one row per table and view, with an audience of `core`
  (enough for most questions), `reference` or `internal`.
- `schema_column`: every column of a core or reference table.
- `schema_example`: worked questions with SQL, run by
  `pipeline/tests/built/schemaDocs.test.ts`, which fails on an example that
  returns no rows.
- `search`: an FTS5 index (porter stemming, so `household` finds `households`,
  and `MATCH 'household*'` finds a prefix) over measures, datasets, dimension
  members, areas and places. Each row has a `kind`, a `key` that finds the row
  in its own table (a slug, `dimension:code`, an area code or a place id), a
  `label` and a `body` of more searchable text. An area has one row, named as
  on its latest release, not one per boundary change. Join `key` back to the
  table to read the row, such as `search JOIN measure ON slug = key`.

The text lives in `pipeline/src/storage/schemaDocs.ts`. The build fails on a
table or view with no entry, or a core or reference column with no
description, so the docs cannot fall behind the schema.

Views join the core tables into readable rows: `v_observation`, `v_series`
(what a dataset holds), `v_area_version` and `v_area_current` (each area at its
latest version), `v_crosswalk_edge`, `v_crosswalk_weight`, `v_area_change`,
`v_contest`, `v_candidacy`, `v_source_terms` and `v_election_terms`. A view
adds no data and is not the API's read path: API readers query stored tables.

## Website assets

`website_asset` stores the website’s compressed release assets in
`website-assets.sqlite`, not in `atlas.sqlite`. Only the Next.js website reads
them, so the API's release stays to what the API serves.

`crosswalk_edge_check` stays in `atlas.sqlite`. The API reads it at request
time (see "What `atlas.sqlite` keeps" in `data/build/README.md`), so it is not
build-only output. The payload documents the API also reads are in
`atlas-build.sqlite`. The sold core excludes `crosswalk_edge_check`; assemble the optional `crosswalk-checks` module with core to restore it for API responses.

The deprecated read-only views for legacy table names and camelCase columns
are no longer written (see `data/build/README.md`). No reader used them.

## STRICT tables

Ordinary tables in `atlas.sqlite` and sold modules use `STRICT`. SQLite FTS
virtual tables and their shadow tables are managed by SQLite and cannot be
declared STRICT. The internal place index uses `ANY` for packed labels because
the writer stores either a binary posting list or JSON text. STRICT adds type
enforcement without changing the columns or how readers interpret existing
files. The cache's `meta`,
`payloads` and `cache_generation` tables are STRICT too: the cache is always
written whole, so nothing is copied forward from an older file.

## Naming and separation conventions

Every database in `data/build` follows these rules (#713):

- Tables are STRICT, except FTS5 virtual and shadow tables.
- Table, view and column names are snake_case, and table names are singular
  (`area_release`, not `area_releases`).
- A reference to another table is a declared foreign key. `boundary_release.geography`
  references `geography(slug)`; `area` and the release tables use integer ids.
  A build metadata file never declares a foreign key into the database it
  describes, because the two are separate files.
- Domain tables hold data, not build metadata (artifact paths, content hashes,
  byte counts, header copies of inventories, routing config), and the canonical
  file holds no payload documents. These live in the build metadata file
  beside each database (`atlas-build.sqlite`, `atlas-base-build.sqlite`,
  `postcode-index-build.sqlite`; `packages/atlas-db/src/buildMetadata.ts`,
  `pipeline/src/storage/buildMetadataWriter.ts`). A table is build metadata
  when it is named `*_metadata` or `*_build`, is a payload table, or is one of
  the routing tables, and the checker flags one in a domain database.

`pipeline/src/storage/schemaConventions.ts` checks the rules and
`pipeline/tests/built/schemaConventions.test.ts` runs it on each built file.
The test carries one allowlist of what still breaks the rules, so the list
shrinks as work lands and an entry that stops matching fails the test. Today
nothing is allowlisted for `atlas.sqlite`, `atlas-base.sqlite` or the postcode
index. The cache and `website-assets.sqlite` carry payloads and hashes as their
data, so they keep their own entries.

The separation moved, out of `atlas.sqlite` and into the build metadata file:

| Was in `atlas.sqlite`                                                                                                                           | Now in `atlas-build.sqlite` |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `payloads`                                                                                                                                      | `payload`                   |
| `area_inventory_metadata`, `crosswalk_inventory_metadata`, `crosswalk_coverage_entry`, `named_location_inventory_metadata`, `boundary_registry` | the same names              |
| `area_release.artifact`, `content_hash`, `record_count` and the parse properties                                                                | `area_release_build`        |
| `boundary_release.metadata_hash`                                                                                                                | `boundary_release_build`    |
| `crosswalk.artifact`, `content_hash`, `record_count`, `bytes`                                                                                   | `crosswalk_build`           |
| `dataset.fingerprint`, `compiled_*`, `payload_id`                                                                                               | `dataset_build`             |
| `statistics_read_path`, `statistics_selector*`, `statistics_observation_fallback`                                                               | the same names              |
| `postcode_area_shard_hash`                                                                                                                      | the same name               |

`meta` still holds `buildId`, `gitCommit`, `gitDirty` and `dataRelease`:
the file describes itself (#678, #724), so those stamps stay. The schema
version is 4 because the table layout changed.

Some references stay undeclared on purpose:

- `statistics_selector.geography` and the other build metadata tables name a
  domain row by its natural key (`geography.slug`, `dataset.id`). They live in
  `atlas-build.sqlite`, so a foreign key would cross files.
- `crosswalk_coverage_entry.geography`: declaring it needs a `geography` parent
  row in every fixture that builds a crosswalk, which touches about fourteen
  tests for no change in behaviour.
- `place_geometry` has no geography column to declare.
- The QA `conversion_*` tables share `BACKTEST_SCHEMA` with the
  `converted_component` database, which has no `weight_basis` table to
  reference.
- `v_source_terms` keeps its name: "terms" is the legal vocabulary (licence
  terms), the object is a view, and the conventions check covers tables only.

### Area locations

`area_location` is a core table with one row per area version. Its WGS84
longitude and latitude use the published ONS population-weighted centroid for
the 2021 England and Wales output area release where it lies within the bounds.
Otherwise they use a polygon interior point; `method` identifies the source. The bounding box uses WGS84
longitude and latitude rounded outward to six decimal places. `gap` explains
why a row has no coordinates. See [the coverage audit](area-geometry-coverage.md)
for the observed gaps and example queries.

`area_hierarchy` stores direct child and parent area-version assignments from
crosswalks, indexed in both directions. Join each version to `area_release`
for geography and vintage, and `crosswalk` for its source. Published clean
containment is labelled `exact`; best fit, geometry-derived containment (which
allows boundary slivers), and official membership lookups without independent
containment verification are labelled `approximate`. An approximate label can
therefore also mean that exactness is unverified. Identity and overlap
crosswalks are excluded. Publisher `area_relationship` statements remain in
their dataset modules and are not copied into core. No transitive relationships
or missing geography combinations are inferred.

```sql
SELECT r.geography, r.release, a.code, v.name, h.accuracy, c.slug
FROM area_hierarchy h
JOIN area_version v ON v.id = h.parent_version_id
JOIN area a ON a.id = v.area_id
JOIN area_release r ON r.id = v.release_id
JOIN crosswalk c ON c.id = h.crosswalk_id
WHERE h.child_version_id = ?;
```

Use `WHERE h.parent_version_id = ?` and join `h.child_version_id` instead to
find children. These are direct links, and multiple releases can give multiple
assignments.

`place_location` supplies a polygon interior point for each named `place`,
using the rounded geometry stored in `place_geometry`. The latter table already
holds the WGS84 envelope (`min_x`, `min_y`, `max_x`, `max_y`). A missing or
unusable polygon is recorded as a gap. `place` also has editorial bounding
boxes, which can be broad approximations and are not substituted for missing
geometry bounds. For example:

```sql
SELECT p.slug, l.longitude, l.latitude, l.method, l.gap,
       g.min_x, g.min_y, g.max_x, g.max_y
FROM place p JOIN place_location l ON l.place_id = p.id
LEFT JOIN place_geometry g ON g.place_id = p.id
WHERE p.slug = 'greater-manchester';
```
