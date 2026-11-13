# Data organisation

How datasets are grouped across the whole project: source files, build
output, code, website, docs, API and the published database. One taxonomy,
defined once, used everywhere. This note supersedes the module section in
`docs/dataset-declarations.md`; that note still covers the declaration shape
and migration mechanics.

Written 2026-11-10 from a survey of the repo at `a1cd196b7`.

## Problem

Datasets are grouped by at least seven separate vocabularies that have
drifted apart:

| Layer                                                    | Groups used                                                                                  |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `data/source/`                                           | economics, demographics, telecoms, deprivation, housing, geography, lookups, boundaries, ... |
| `dataset.module` (statistics declarations)               | economy, population, infrastructure, housing, crime, deprivation, ...                        |
| Website chart groups (was `lib/datasets/chartGroups.ts`) | Economics, Demographics, Telecoms, General Election, Local Election, Brexit, ...             |
| `components/`                                            | economics, demographics, telecoms, elections, ...                                            |
| Docs and `/datasets` topics (were hand-kept lists)       | people, work, connectivity, people-and-places, work-and-economy, councils, ... (now deleted) |
| `meta.json` `topics` (replaced by `dataset`, task 11)    | Free text                                                                                    |
| `packages/measures/src/statisticsDatasets/`              | By shape (census, people, services), not topic (only five leftovers remain)                  |

Examples of the drift:

- Misfiled sources: `education/housing-affordability`, `economics/housing/*`
  (house prices, net additional dwellings), `economics/crime`,
  `economics/homelessness`, `economics/child-poverty`, `economics/fuel-poverty`.
- The website Economics group has 19 cards, including 7 housing datasets,
  crime, child poverty and fuel poverty.
- Source folder names differ from dataset ids: `road-safety` builds
  `road-collisions`, `ks4-performance` builds `school-performance`,
  `pupil-attendance` builds `pupil-absence`, `telecoms/mobile` builds
  `mobile-coverage`, `referendum` builds `brexit`, `energy-consumption` builds
  `electricity-consumption` and `gas-consumption`, `council-tax-stock` builds
  `council-tax`, `nhs-waiting-times` builds `nhs-waiting`,
  `public-health-outcomes-framework` builds `public-health`.
- Dataset ids that encode a geography or history: `regional-gdp-itl1/2/3`,
  `brexit-constituency`, `population-constituency`, `population-uk`,
  `school-performance-constituency`, `life-expectancy-series`,
  `historical-general-election`.
- Source nesting depth varies: `politics/elections/local-elections/...`,
  `demographics/population/census-2021-lsoa`, `economics/housing/mean-price-by-ward`.
- Unused sources: seven in `health/` (childhood-vaccination-cover,
  english-prescribing-dataset, gp-appointments, gp-registered-patients,
  hospital-admitted-care, ons-deaths-by-area, primary-care-workforce) and `economics/household-economic-activity`.
- Build output is flat: 58 files in `data/build/datasets/`, 937 in
  `data/build/artifacts/exports/`.

## Hierarchy

**Theme → topic → dataset → measure**, for finding and filing data.
**Modules**, for downloading it, are a separate layer built from topics.

- A **theme** is a broad subject area. Closed list of about ten that should
  rarely change. It is the top-level folder everywhere, a website panel
  section and a docs section.
- A **topic** is a subject within a theme. Open list, registered with a label
  and description. Expect 3 to 15 per theme. It is the second-level folder.
- A **dataset** is one declaration (`dataset.ts`) with one stable kebab-case
  id. It has exactly one primary topic and may list `related` topics.
- A **measure** is a published series within a dataset.
- A **source** is one publisher release (raw files plus `meta.json`). It is
  provenance, and lives inside the dataset that reads it.
- A **module** is a download unit: a named set of topics. By default there is
  one module per theme, split along topic lines when it gets too big or a part
  has a different licence. Modules never appear in folder paths.

Navigation and packaging are kept apart because they change for different
reasons. Navigation must stay broad and stable so people learn it once.
Packaging follows size, licence and what customers buy, and will change. If
folder paths followed modules, every repackaging would move files and break
links.

This scales: 10 themes × 10 topics × 5 datasets is 500 datasets with no
folder holding more than about 15 entries.

## Themes and topics

Themes follow the ONS taxonomy loosely, so classification has precedent and
people used to ONS or GOV.UK find things where they expect. The registry in
`packages/datasets/src/declaration/` is the only place theme and topic ids,
labels, descriptions and display order are defined.

Foundation data is not a theme. It is always (`core`) or optionally
(`boundaries`, `postcodes`) downloaded:

| id           | Contents                                                                                                                                                                |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core`       | Areas, releases, crosswalks, lookups, named places, the catalogue of every module, denominators (population totals, households, dwellings, land area). Always included. |
| `boundaries` | Boundary geometry (GeoParquet). Large.                                                                                                                                  |
| `postcodes`  | Postcode lookups (ONSPD). Large.                                                                                                                                        |

Themes, with initial topics and where today's datasets go:

| Theme            | Label                   | Topics (datasets)                                                                                                                                                                                                           |
| ---------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `population`     | People and population   | `population-estimates` (population), `ethnicity-and-identity` (ethnicity). Later: migration, households.                                                                                                                    |
| `economy`        | Economy and work        | `labour-market` (claimant-count, unemployment, jobs), `earnings-and-income` (income, workplace-income), `business` (business-activity), `economic-output` (regional-gdp), `public-finance` (local-government-finance)       |
| `housing`        | Housing                 | `prices-and-affordability` (house-price, housing-affordability), `housing-stock` (housing-tenure, council-tax, net-additional-dwellings), `planning` (planning-applications), `homelessness` (homelessness)                 |
| `health`         | Health and care         | `health-status` (general-health, public-health), `life-expectancy` (life-expectancy), `nhs-services` (nhs-waiting; later GP, hospital, prescribing), `social-care` (adult-social-care-activity, adult-social-care-outcomes) |
| `education`      | Education               | `schools` (school-performance, pupil-absence), `qualifications` (qualification)                                                                                                                                             |
| `society`        | Society and communities | `deprivation` (imd, wimd, simd, nimdm), `poverty` (child-poverty, fuel-poverty), `crime-and-justice` (crime)                                                                                                                |
| `politics`       | Elections and democracy | `general-elections` (general-election), `local-elections` (local-election), `referendums` (brexit)                                                                                                                          |
| `environment`    | Environment and energy  | `air-quality`, `emissions` (ghg-emissions), `energy` (electricity-consumption, gas-consumption), `waste`. Later: flood risk.                                                                                                |
| `transport`      | Transport               | `commuting` (travel-to-work), `vehicles` (car-availability, electric-vehicle-chargers), `road-safety` (road-collisions)                                                                                                     |
| `infrastructure` | Infrastructure          | `digital-connectivity` (broadband, mobile-coverage). Later: utilities.                                                                                                                                                      |

`land-area` and population totals also feed `core` as denominators. A dataset
flags those measures `denominator: true` and the assembler copies them into
core, so no module depends on another.

Changes from today's `DATASET_MODULES`: `deprivation` and `crime` become
topics under `society`; telecoms becomes a topic under `infrastructure`; the
old `core` splits into `core`, `boundaries` and `postcodes`; politics
sub-sections become ordinary topics.

## Classification rules

1. File by what is measured, not by publisher or collection method. Census
   is not a topic: census tenure is housing, census health is health.
2. One primary topic per dataset, which decides its folder. Cross-list with
   `related` topics; the website and docs show the dataset in both places.
3. Composite measures go where people look for them: IMD is
   `society/deprivation`, even though it has health and education domains.
4. No `misc`, `other` or `general` topics. If nothing fits, add a topic.
5. A new topic needs a label, a description and either two datasets or a
   planned second. Until then, use the nearest existing topic.
6. Themes change only by product decision. A topic rename is a `git mv`, a
   registry change and a passing test. After early access, keep aliases.
7. Extend a dataset rather than adding one when it is the same publisher
   series, unit of observation and cadence. Geography and period are
   dimensions, never a reason for a new dataset.

## Naming

- Theme, topic, dataset and module ids are kebab-case and globally unique.
- Dataset ids are not namespaced by path, so moving a dataset to another
  topic never changes its id, its API URL or its SQLite slug.
- A source folder is named after its dataset.
- No geography or year in a dataset id.
- Use an index's official short name only when it is the common name (`imd`,
  `simd`), and give the full name as its label.

## Layout

Theme and topic are in the path wherever people browse. A test asserts that
each path matches the declared topic and theme.

```
data/source/
  core/{lookups,places,land-area,...}/
  boundaries/<geography>/
  postcodes/onspd/
  <theme>/<topic>/<dataset>/meta.json
  <theme>/<topic>/<dataset>/<part>/   when a dataset reads several releases
  _staging/<name>/                    sources not yet built

packages/datasets/src/<theme>/<topic>/<dataset>/{dataset.ts,loader.ts,types.ts}
components/datasets/<theme>/<topic>/<dataset>/   custom charts only
```

Code never hard-codes these paths. Every source folder is named once, in the
`SOURCES` table in `packages/datasets/src/declaration/sources.ts`, as a topic
and a folder. Loaders, pipeline stages and config files ask for a folder by
name (`sourceDir("census-2021-ts001")`, or `sourceInput("name/file")` in
config), and the theme comes from the topic. Moving a source is a change to
that table and a move of the folder. A test fails on any literal path to a
source folder in code.

Task 5 moved `data/source` to this layout and task 6 named each folder for the
dataset id it serves. Sources no dataset reads sit in `_staging/`.

Task 7 moved the declarations into `packages/datasets/src/<theme>/<topic>/<dataset>/`.
Five datasets are still hand written, with reasons in
`docs/dataset-declarations.md`. Loaders and types have not moved yet.

Task 8 moved the custom charts into
`components/datasets/<theme>/<topic>/<dataset>/`. Code shared by a topic or a
theme sits as files at that level (`society/deprivation/`,
`politics/PartyVotes.tsx`). A test checks each folder against the registry.
The `lib/datasets/<camelCase>.ts` files stay: a declaration's `display` block
cannot yet express their card, `calculateStats`, map value or legend, and only
claimant count, broadband and mobile coverage (which already have no file)
use it.

Task 9 made the docs, `/datasets` and `llms.txt` read the registry. Docs have
a page per theme (`/docs/v1/datasets/<theme>`), topic
(`/docs/v1/datasets/<theme>/<topic>`) and dataset
(`/docs/v1/datasets/<theme>/<topic>/<dataset>`). The 16 registry datasets the
API does not serve get a page without API sections. The old
`/docs/v1/data/<slug>` and `/docs/v1/datasets/<slug>` pages redirect to the
page that replaced them (`lib/docs/legacyDataPages.ts`), except
`/docs/v1/datasets/population`, which is now the population theme. No
`THIN_TOPIC_ALLOWLIST` entry is fixed by this task.

Task 10 added `theme`, `topic` and `module` to API datasets and measures
(listings and detail), `theme`, `topic` and `module` filters on
`GET /v1/datasets` and `GET /v1/measures`, `GET /v1/themes` and
`GET /v1/modules`. All three values come from the registry
(`@uk-data-atlas/datasets/registry`), so `atlas.sqlite` and the pipeline are
unchanged. `dataset.module` in SQLite is derived the same way, by
`moduleOfTopic`. An unknown filter value is a 400 with
`code: unknown_filter_value`. Datasets the registry does not file (a few test
fixtures) omit the three fields, and the one catalogue id the registry spells
differently (`school-performance-disadvantage`) is mapped in
`services/api/src/catalogue/datasetTaxonomy.ts`. `/v1/modules` lists only what
the registry knows, plus the foundation parts with no datasets; task 12 added
the manifest fields.

Task 11 replaced `meta.json` `topics` with `dataset`. The schema is a zod
schema in `packages/datasets/src/data/catalog/meta.ts` (`parseDatasetMeta`),
strict, so an unknown field such as `topics` is an error. A source of `kind`
`dataset` (the default) must name a registered dataset. The other kinds feed no
dataset and must not name one: `boundary`, `lookup`, `postcode-directory`, and
two added here, `support` (crosswalk weight sources in `core/`) and `staged`
(everything in `_staging/`). A folder that feeds several datasets names the one
it is named for, or the first of its group (`regional-gdp` names
`regional-gdp-itl1`, `energy-consumption` names `electricity-consumption`); the
full lists stay in `packages/datasets/src/declaration/sourceDatasets.ts`. The raw sources are not in
git, so `scripts/migrate-source-meta.mjs` (run by `pnpm data:download`, or by
hand with `--dry-run` first) adds `dataset` or `kind`, drops `topics` and
refreshes the release marker. The pipeline writers no longer emit `topics`.
`tests/built/data/sourceFolders.test.ts` now validates every `meta.json`,
including boundaries, lookups and postcodes. The free-text topics are gone, and
the registry already holds each dataset's theme and topic. No allowlist entry
named this task.

Task 12 added module manifests and the `data/dist/` generator. A manifest is
built by `buildModuleManifests` in `packages/datasets/src/declaration/modules.ts`
from the registry (themes, topics, datasets, `moduleOfTopic`) and the licence
names recorded for each dataset, so a split such as task 16's changes only
`moduleOfTopic`. It carries the id, label, description, themes, topics,
datasets, resolved licences, a `licenceConflict`, the core compatibility key
(`atlas-core-1`, bumped when a change to core breaks modules built before it),
the manifest `schemaVersion`, and a `build` block whose size and file checksums
are null until task 13 fills them. Licences resolve to ids (`ogl-3.0`,
`open-parliament`, `cc-by-sa-3.0`) from the `meta.json` licence name; a name
that matches none fails `pnpm data:dist`. `politics` is flagged today because
the 2016 to 2019 local elections are CC BY-SA 3.0 beside Open Parliament
Licence data. The flag is a warning, not a split. `pnpm data:dist [--release
<name>]` reads `data/source` and writes `data/dist/uk-data-atlas-<release>/`
(gitignored): the top-level `README.md`, `catalogue.json`, `licences.json` and
`CHANGELOG.md`, a `README.md` per module and `sqlite/atlas-<module>.manifest.json`.
A module's READMEs say the database is not built, and show no size, until
`pnpm data:dist` finds a build for it. `GET /v1/modules` serves the same
manifests, with licences read from the catalogue, so the API and the dist tree
cannot drift; the fields were added without changing existing ones.

Task 13 added the module builds and the assembler (roadmap tasks 19 to 23).
`atlas.sqlite` is unchanged. The `build-modules` stage
(`node pipeline/build-data.mjs --only build-modules`, after `assemble-atlas`)
splits it into `data/build/modules/`:

- `sqlite/atlas-core.sqlite`: the foundation tables (releases, areas,
  crosswalks, measures, dimensions, periods, sources, the catalogue), the
  `module` and `module_dataset` tables that list every module including ones
  not installed, `core_denominator` (population, households, usual residents
  and area, totals only) and the views over core tables.
- `sqlite/atlas-<module>.sqlite`: one per module. A theme module holds its
  datasets, series, observations and the metadata bound to them
  (`series_input`, `series_gap`, `series_conversion`, `series_crosswalk`,
  `conversion_skip`, `area_relationship`, area keys and names, elections).
  `postcodes` holds the `postcode*` tables and the postcode payloads. Rows point
  at core by the stable ids from `pipeline/ids`, which core assigns. A module
  that points at another module's series fails the build.
- `<module>/parquet/<table>.parquet`: the same tables as ZSTD Parquet, written
  with DuckDB, and `duckdb-views.sql`, which creates one view per table over
  these files.
- `build.json`, which `pnpm data:dist --release <name>` reads to link the files
  into the release tree, fill each manifest's size, files and SHA-256 and
  regenerate the READMEs.

Views over module tables are stored in core's `module_view` table (SQL, order,
and the tables each needs) because a view in an attached database cannot read
another database. The assembler creates a view only when its tables are present.

`pnpm data:assemble --from <release dir> --modules a,b --out <file>
[--allow-licence-conflict]` builds one self-contained SQLite file: core plus the
chosen modules, with `module.installed` set, the module hashes and licences in
`meta`, and `PRAGMA foreign_key_check` clean. SQLite attaches at most 10
databases and has no foreign keys across files, so the modules are copied into
one file, not attached. It refuses a module that is not built, whose manifest or
database names a different core compatibility key, or whose manifest carries a
licence conflict (`politics`) unless the flag is given. Modules are applied in id
order and the file is vacuumed, so the same inputs give the same bytes whatever
order the modules are named in.

Where the two documents differ, the roadmap's technical detail won:

- The roadmap ships Parquet as one folder per module with a DuckDB views file.
  The organisation doc files per-measure Parquet beside each dataset under
  `<theme>/<topic>/<dataset>/`. Only the module folders exist; dataset folders
  stay with the later dataset folder work.
- The roadmap lists `demographics` and `deprivation` modules and merges
  environment, transport, infrastructure and crime. The registry's modules (task 12) are the ones built, and task 16 changes the split.
- The `boundaries` module is not built, since it needs GeoParquet.
- `denominator: true` is not yet in the declarations, so the denominators in
  core are a fixed list of measures in `pipeline/src/modules/moduleTables.ts`.

### Naming

A folder is named for a dataset it feeds, and `SOURCES` derives it: a source's
key is its folder name, so only a part needs a folder written out
(`house-price/mean-price-by-ward`, `general-election/2010`). Dataset ids are
stable and public, so a rename changes the folder and its `meta.json` id, never
the dataset. `packages/datasets/src/declaration/sourceDatasets.ts` lists every folder with the
datasets it feeds. A folder not named for a dataset carries a reason there:

- `environment/energy/energy-consumption` feeds `electricity-consumption` and
  `gas-consumption` from one download. Splitting it into two folders would need
  the download split too, so it stays.
- `economy/economic-output/regional-gdp` feeds `regional-gdp-itl1`, `-itl2` and
  `-itl3`. Task 15 merges them under one id, which is the folder's name.
- `core/` and `_staging/` folders are foundation data and unbuilt sources, so
  the rule does not apply to them.

The census tables `ts037` and `ts054` feed two datasets each (the census table
and a derived one, `general-health`, `housing-tenure`). They are named for the
census table, `census-2021-ts037`. Task 15 and the dataset renames may move
`ts054` under `housing-tenure/census-2021`.

### Moving an existing checkout

`data/source/` is not in git; `pnpm data:download` syncs it from a GitHub
Release. The release assets are still in the old layout until a new release is
published, so both routes below end in the final layout and neither needs the
release to change. A checkout in the old layout or the task 5 layout reaches the
same place.

- `node scripts/migrate-source-layout.mjs` moves an existing `data/source` in
  place, sets the `id` in each renamed folder's `meta.json` to the folder name,
  rewrites `.source-release.json` to match, and is safe to run again.
  `--dry-run` lists what it would do. It reports conflicts and stray files and
  leaves them alone.
- `pnpm data:download` runs the same migration first, and again on a freshly
  extracted old-layout release, so a checkout on either layout ends up correct.
- On another machine or the server: pull this branch, then run
  `node scripts/migrate-source-layout.mjs --dry-run` and, if it lists only
  moves, run it again without `--dry-run`. Run `pnpm data:download` afterwards
  to check nothing reports as edited. The script does nothing on a machine
  already in the final layout.
- `scripts/serve-os-open-roads.mjs` expects its manually downloaded tiles at
  `data/source/transport/os-open-roads/`. They are not a dataset source and the
  migration does not touch them.

`meta.json` replaces free-text `topics` with `dataset`, validated against a
schema. Theme and topic come from the declaration, not repeated here.

## Modules

A module manifest names its id, label, topics, licence and compatible core
versions. Defaults:

- One module per theme, with the theme's id.
- Split along topic lines when a module's SQLite passes about 500 MB, or when
  a part has a different licence. Expected first splits: `population` into
  `population` and `population-detail` (single-year-of-age and small-area
  census), and `politics` into `politics` and `politics-sharealike` (the CC
  BY-SA 2016 to 2019 local elections).
- Small modules can be sold together as bundles; a bundle is a list of
  modules, not a new grouping.

Module ids are published and stable, but which topics a module holds can
change between releases, recorded in the changelog.

## Build and distribution

`data/build/` stays the internal build cache. The product is a separate tree,
`data/dist/`, laid out for people and agents to navigate:

```
uk-data-atlas-<release>/
  README.md  catalogue.json  licences.json  CHANGELOG.md
  core/  boundaries/  postcodes/
  <theme>/README.md                      generated: topics, datasets, licences
  <theme>/<topic>/<dataset>/
    README.md  dataset.json              measures, geographies, periods, source
    <measure>.parquet  <measure>.csv.gz
  sqlite/
    atlas-<module>.sqlite  atlas-<module>.manifest.json
```

A download is a set of modules. It contains `core/`, the theme and topic
folders those modules cover, and their SQLite files. The assembler (reusing
`assemble-atlas`) can join core plus the chosen modules into one
`atlas.sqlite`. Parquet folders come with a DuckDB views file that reads
whatever folders are present. Core's catalogue lists every module, including
ones not downloaded, so an agent can say "this needs the health module".

This builds on `docs/database-roadmap.md`, tasks 16 and 19 to 24.

## SQLite attach limit

SQLite can attach at most 10 extra databases to one connection by default
(`SQLITE_MAX_ATTACHED`). The `sqlite3` CLI and `node:sqlite` both use 10. The
limit can be raised to 125, but only by recompiling SQLite, which users'
tools won't have done. Attached databases also lose foreign keys across files,
and a view or trigger stored in one file can't refer to tables in another.

So "attach one file per module" breaks once there are more than 10 modules,
and breaks joins before that. Hence one assembled file for SQLite users, and
per-module Parquet for DuckDB users, which has no such limit. With assembly,
the number of modules can grow freely.

## Website and docs

- Chart panel sections are themes, with topics as collapsible sub-groups,
  both generated from the registry.
- At hundreds of datasets not every card can show at once. Each theme has a
  curated default set; the rest are reached through search and an "add card"
  control. Place pages follow the same rule.
- `/datasets`, docs data pages and `llms.txt` have a page per theme, topic
  and dataset, generated from declarations.
- The hand-kept topic lists (`lib/docs/content/data.ts` and
  `lib/reference/datasets.ts`) are deleted.
- The API refers to datasets by id, never by path. It adds `theme`, `topic`
  and `module` to catalogue and dataset responses, filters on each, and
  `GET /v1/themes` and `GET /v1/modules`.

## Tasks

**P0** stops drift and is cheap. **P1** is the restructure. **P2** improves
quality and size. **P3** is product polish.

| #   | Priority | Task                                                                                                                                                                         |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | P0       | Ratify themes, topics and the classification rules. Replace `DATASET_MODULES` with a theme and topic registry, and point `docs/dataset-declarations.md` here.                |
| 2   | P0       | Give every dataset a primary topic (and so a theme). Every dataset in `atlas.sqlite` has one, non-null, and the old `module` column is derived from it.                      |
| 3   | P0       | Consistency test: source path matches declared theme and topic; every source folder has a `meta.json` naming its dataset; unused sources are in `_staging/`; ids are unique. |
| 4   | P0       | Generate website chart sections from themes and topics. Fixes the 19-card Economics group.                                                                                   |
| 5   | P1       | Move source folders to `data/source/<theme>/<topic>/<dataset>/`, including the core, boundaries and postcodes split. Loaders resolve paths from their declaration.           |
| 6   | P1       | Rename source folders to dataset ids (see Problem).                                                                                                                          |
| 7   | P1       | Finish the declarations migration into `packages/datasets/src/<theme>/<topic>/<dataset>/`, theme by theme, dissolving `statisticsDatasets/*.ts`.                             |
| 8   | P1       | Move custom charts to `components/datasets/<theme>/<topic>/<dataset>/`; delete per-dataset files in `lib/datasets/` as each dataset is declared.                             |
| 9   | P1       | Docs: pages per theme, topic and dataset from declarations; group `/datasets`, `llms.txt` and API docs the same way; delete the old topic lists.                             |
| 10  | P1       | API: `theme`, `topic` and `module` on responses, filters, `GET /v1/themes`, `GET /v1/modules`.                                                                               |
| 11  | P1       | `meta.json` schema with `dataset`, replacing `topics`.                                                                                                                       |
| 12  | P1       | Module manifests (id, topics, licence, core compatibility) and the `data/dist/` layout with generated READMEs.                                                               |
| 13  | P1       | Per-module SQLite and Parquet builds plus the assembler (roadmap tasks 19 to 23).                                                                                            |
| 14  | P1       | Website: curated default cards per theme, plus search and "add card" for the rest.                                                                                           |
| 15  | P2       | Merge datasets split by geography or history: `regional-gdp`, `brexit`, `school-performance`, `population`, `life-expectancy`, `general-election`. Keep API aliases.         |
| 16  | P2       | Measure size per module and make the first splits (`population-detail`, `politics-sharealike`).                                                                              |
| 17  | P2       | `related` topics: cross-listing on the website and in docs.                                                                                                                  |
| 18  | P2       | Decide on the 8 unused sources: build, keep in `_staging/`, or delete.                                                                                                       |
| 19  | P3       | Bundles for sale (for example public services, full) with download sizes.                                                                                                    |
| 20  | P3       | Theme icons and colours, used across website, docs and published READMEs.                                                                                                    |
