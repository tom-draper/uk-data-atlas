# Database roadmap

Improvements to the precompiled database (`data/build/atlas.sqlite` and its
companions). Collected from a review on 2026-11-05 and refreshed on
2026-11-19. The aim is a database that can be sold as modules and queried by
people and agents, with the boundary intelligence and crosswalks as its core
value.

Priorities: **P0** before selling or exposing SQL to agents, **P1** structure
and product readiness, **P2** cleanup and size, **P3** nice to have. A task
marked **Done** or **Partly done** keeps its number so links stay valid; the
detail is under [Progress notes](#progress-notes).

## Measured state

Measured on the local build of 2026-11-19 unless stated.

- `atlas.sqlite` is 942 MB, up from 742 MB on 2026-11-05.
- Largest objects: `postcode` 284 MB, `observation` 214 MB, `area_location`
  89 MB, `crosswalk_edge_check` 49 MB, `crosswalk_edge` 38 MB plus its two
  indexes 61 MB, `area_version` 35 MB, `area_hierarchy` 29 MB plus its parent
  index 18 MB, `crosswalk_weight` 19 MB, `search` 14 MB.
- 1,643 series are `published` and 1,003 `converted` (on the four standard
  releases, task 25). No `aggregated` series exist.
- Crosswalks: 207 with 2.16M edges. 98.7% of edges regroup exactly and weigh
  1 by rule; 99.96% have a residents weight (2026-11-08).
- 42 of 96 measures are refused for conversion, each with its reason in
  `measure_conversion`.
- Modules build to `data/build/modules/` (1.1 GB in all): per-module SQLite
  and Parquet, a DuckDB views file and the `crosswalk-checks` add-on.
- Observations by module (2026-11-05): population 5.8M (63%), housing 1.1M,
  deprivation 505k, economy 504k, health 490k, politics 387k, transport 225k,
  environment 111k, education 28k, crime 14k, infrastructure 4k.
- SQLite's attach limit is 10 in both the `sqlite3` CLI and `node:sqlite`.

## Status at a glance

| Status      | Tasks                                                                |
| ----------- | -------------------------------------------------------------------- |
| Done        | 1, 4, 5, 6, 11, 14, 15, 25, 28, 30, 31, 32, 33, 46, 62               |
| Mostly done | 2, 3, 10, 16, 19, 20, 21, 22, 23, 47                                 |
| Partly done | 7, 8, 9, 17, 35, 39                                                  |
| Kept as is  | 12 (measured, keep the wide table)                                   |
| Not started | 13, 18, 24, 26–29, 31, 32, 34, 36–38, 40–45, 48–51, and new 52 to 61 |

## Core data quality

| #   | Priority | Status      | Task                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | -------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | P0       | Done        | Weight every common crosswalk from the smallest held units (2021 output areas, postcode counts), on several bases per edge. Left: Northern Ireland, Scottish dwellings and the area basis on the postcode-overlap crosswalks, now task 56.                                                                                                                                                                                                                                                                                                                                                     |
| 2   | P0       | Mostly done | Stable IDs from append-only registries in `pipeline/ids/`. Left: confirm the seed against the deployed file with `pnpm ids verify` before the next deploy. The postcode lookup's own numbering stays internal.                                                                                                                                                                                                                                                                                                                                                                                 |
| 3   | P0       | Mostly done | Make the database self-contained (boundary release metadata, coverage, editions, selectors and vocabulary in tables). Left: legal effective-date intervals beyond the four recorded polling dates (see #426).                                                                                                                                                                                                                                                                                                                                                                                  |
| 4   | P0       | Done        | Every measure has a conversion rule and reason in `measure_conversion`, with `numerator_id`, `denominator_id` and `weight_id`. Lifting a refusal means holding the missing part as a measure.                                                                                                                                                                                                                                                                                                                                                                                                  |
| 5   | P0       | Done        | Licences in the database: `v_source_terms`, `v_election_terms`, `delivery_licence`. The CC BY-SA 2016–19 local elections are isolated in the `politics-sharealike` add-on.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 62  | P0       | Done        | A safe default observation view: `v_observation_default` returns one value for each quantity, area and period, so naive SQL does not double count. Built from `measure_dimension` (breakdown or qualifier, 52 rows), `quantity` (845) and `series_preference` (1,260 ranked series, 129 quantities with more than one). Measured on a copy of the build: one area with every measure 9 ms against 86 ms on `v_observation`, one measure on one release 34 ms against 357 ms, all households on 2021 LSOAs 218 ms against 11.8 s. Choices are in `packages/measures/src/measurePreferences.ts`. |
| 6   | P1       | Done        | Code changes as dated events in `area_change_event`. Follow-ups: switch `area-lineage.json` readers to the table, legal dates from the ONS Code History Database, and the official lookups that would show ward splits and merges.                                                                                                                                                                                                                                                                                                                                                             |
| 7   | P1       | Partly done | Area versions have an interior point and bounding box, or an explicit gap; published 2021 output-area centroids are used where available. Left: wider population-weighted coverage and GeoParquet boundaries as a module. `area_location` is 89 MB (see task 55).                                                                                                                                                                                                                                                                                                                              |

## Structure and maintainability

| #   | Priority | Status      | Task                                                                                                                                                                                                                                                |
| --- | -------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8   | P1       | Partly done | Make the tables canonical and JSON derived. Done: `areas` and `datasets` views removed, postcode dictionaries replaced, crosswalk endpoint fields derived by readers. Left: drop `crosswalk.header` and the remaining kept-in-step representations. |
| 9   | P1       | Partly done | One compiled form per dataset. Compiled observation artifacts are gone and readers use database payloads. Left: direct-to-rows ingestion (#528) and the remaining declaration migrations (#708).                                                    |
| 10  | P1       | Mostly done | Docs inside the database (`schema_table`, `schema_column`, `schema_guide`, `schema_example`, `search`). Left: one schema definition shared by writer and reader (`SOURCE_FIELDS` is still duplicated) and generating the README tables.             |
| 11  | Done     | Done        | Ordinary published tables use `STRICT`. FTS tables are managed by SQLite and cannot be STRICT.                                                                                                                                                      |
| 12  | P2       | Kept as is  | Postcode table design. Measured: keep the wide table (see below).                                                                                                                                                                                   |
| 13  | P2       |             | Store unchanged areas once, as a span rather than an edge per release. 1M area versions for 307k areas. Roughly 100 MB.                                                                                                                             |

Task 12 measured (2026-11-15), on the 363,363 postcodes starting with S
(13.6% of 2,665,797), scaled up and accurate to about 10%. The file then was
268 MB: `postcode` holds one distance per release that has its own value and
shares one `postcode_area_set` row between the 63,452 distinct combinations of
areas.

| Shape                                                                      | Estimated size | Against today |
| -------------------------------------------------------------------------- | -------------- | ------------- |
| Wide `postcode` plus `postcode_area_set` (today)                           | 268 MB         | 1×            |
| Long `postcode_area`, every distance stored (9.8M rows per 363k postcodes) | 1,440 MB       | 5.4×          |
| Long `postcode_area`, distance only where stored                           | 1,330 MB       | 5.0×          |
| Sets and stored distances as long tables, postcodes keep `area_set_id`     | 680 MB         | 2.5×          |
| Postcode to output area only (lower bound, not equivalent)                 | 104 MB         | 0.4×          |

The one-row-per-postcode-per-release shapes cost 5 times the size because the
wide table already shares areas between postcodes and leaves 25 of 29
distances null. Output-area only is smaller but loses the containment and
several-area matches the API returns. A new release adds two columns to a
generated table, and the layout marker (`postcodeAreaLayout`) rejects stale
files. If drift becomes a problem, the third shape is the cheapest way to
remove it.

## Size and query performance

| #   | Priority | Status      | Task                                                                                                                                                                                 |
| --- | -------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 14  | P1       | Done        | `ANALYZE` and `PRAGMA optimize` at the end of the build, and indexes for ad-hoc queries.                                                                                             |
| 15  | P1       | Done        | `observation_area` index dropped; readers use the primary key.                                                                                                                       |
| 16  | P1       | Mostly done | Parquet (zstd) alongside SQLite. The module build writes Parquet per module with a DuckDB views file. Left: publish it as a download with the versioned bundles (task 53).           |
| 17  | P2       | Partly done | `crosswalk_edge_check` sits in the optional `crosswalk-checks` module for sold builds (saves 46 MiB), but still ships in the serving `atlas.sqlite`. Moving `payloads` remains open. |
| 18  | P3       |             | Store postcode distances in metres, not centimetres. Probably tens of MB, not measured.                                                                                              |

Rejected: storing each series as a packed array per period. It was about
20 MB and made whole-map reads 60× faster, but single-area reads 50× slower,
and it can't be queried with plain SQL. Parquet gets the same size and stays
queryable.

## Modules

| #   | Priority | Status      | Task                                                                                                                                                                             |
| --- | -------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 19  | P1       | Mostly done | Build modules separately, deliver one assembled SQLite file per purchase (`pipeline/src/modules/`, `pnpm delivery:create`). Left: bundles for sale and their sizes.              |
| 20  | P1       | Mostly done | Core assigns every ID, through the `pipeline/ids/` registries.                                                                                                                   |
| 21  | P1       | Mostly done | Modules point only at core. `core_denominator` copies the denominators modules need.                                                                                             |
| 22  | P1       | Mostly done | Core lists every module and its datasets (`module`, `module_dataset`, `module_view`).                                                                                            |
| 23  | P1       | Mostly done | Module compatibility key, checked by the assembler. Left: a full manifest per module (version, sources, licences, row counts, hashes), with `docs/data-organisation.md` task 12. |
| 24  | P0       |             | Release manifest and changelog with diffs between releases (areas, series, values). Raised from P1: versioned bundles (task 53) need it, and stable IDs (task 2) now allow it.   |

Suggested modules are listed in `docs/data-organisation.md`, "Modules".

## Precomputations

| #   | Priority | Status | Task                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | -------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 25  | P0       | Done   | Every convertible measure rebuilt on the latest local authorities, wards and constituencies and 2021 LSOAs, each scored. See `docs/conversion-accuracy.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 26  | P1       |        | Roll up every area to its parents (LSOA → MSOA → local authority → region → country), only for measures that can be summed or rebuilt as a ratio.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 27  | P1       |        | Rebuild rates from numerator and denominator (per 1,000 residents or households, using core denominators), never by averaging rates.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 28  | P0       | Done   | A coverage table, `series_coverage`, with `v_coverage` (one row per series and period: method, default, share of the release, nations, conversion quality) and `v_coverage_missing` (combinations with no series, and why), so agents check what is answerable before querying (#641). Written at assembly after `series_preference`, split with the modules that own the series. Measured on the local release: 9,349 rows (10.7 million observations), 258,048 bytes by dbstat, 17 s to compute, queries in 1 to 10 ms. 1,447 rows cover under half their release. Left: an API and MCP endpoint (#635). |
| 29  | P3       |        | Ranks and deciles within each nation, as views rather than stored values.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## Attribution of derived data

| #   | Priority | Status | Task                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | -------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 30  | P1       | Done   | `series_input` lists every input of a converted series, with `series_crosswalk` and `series_conversion` for its route, rule, weight basis and quality.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 31  | P0       | Done   | `v_series_attribution` (one row per series and contributing source: publisher, licences, commercial use, ShareAlike, `via`, `depth`, `vias`) and `v_series_terms` (one row per series: sources, licences, commercial use as the minimum and ShareAlike as the maximum over sources, unknown when any is) walk the dataset, crosswalk and crosswalk weights, boundary releases, `series_input`, models and their inputs, and the election licences (#640). The walk is materialised at assembly as `series_source`, `series_source_licence` and `series_notice`, which also splits it with the modules. Model inputs are now resolvable references, and the build fails on an unresolved key, a series with no source, or a licence with no attribution text. Measured on the local release: 12,420 source rows over 2,849 series, 2,624 commercial-safe and not ShareAlike, 225 ShareAlike, none unknown; one series in 12 ms, all series in 48 ms, 0.3 s to write; a recursive view over the same tables took 124 ms for all series and could not apply election licences. |
| 32  | P2       | Done   | `v_series_terms.attribution` is a ready-to-print string per series: publishers once, each licence statement once, then the notices sources and boundary files ask for (OS and Royal Mail), built from `licence.attribution` and the source citations.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

## New derived products

Precomputations chosen for what people can't easily get elsewhere. "Held"
means the data is already in the build. Anything estimated is stored as
`modelled`, with its method and inputs recorded, so an estimate never passes
as published data.

### Relationships between areas

| #   | Priority | Status      | Task                                                                                                                                                                                                                                   | Data                          |
| --- | -------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 33  | P0       | Done        | Old code → current code in one step: store chained crosswalks as direct lookups (any ward code since 2011 → 2026 wards), combining weights and recording the accumulated error (#639). The conversion routes already chain internally. | Held                          |
| 34  | P0       |             | How much each area changed between releases: share of land and of residents that moved, and a "materially changed" flag (#414).                                                                                                        | Held                          |
| 35  | P1       | Partly done | Direct parent and child links are in `area_hierarchy`. Left: one flat hierarchy table, one row per small area with its parent at every level, each marked exact or best-fit (#427).                                                    | Held                          |
| 36  | P1       |             | Postcode district and sector → official areas, weighted by residential postcodes or population.                                                                                                                                        | Held (ONSPD, postcode counts) |
| 37  | P1       |             | GP practice → LSOA, weighted by registered patients. NHS ODS codes are now stored as area identifiers.                                                                                                                                 | New source (OGL)              |
| 38  | P1       |             | Neighbours stored per release: shared border length, touch-at-a-point flag, coastline length. Today computed at request time (`packages/areas/src/spatialResolver.ts`).                                                                | Held (geometry store)         |
| 39  | P1       | Partly done | Published 2021 England and Wales output-area centroids are stored. Left: derive population-weighted centroids for other area versions.                                                                                                 | Held                          |
| 40  | P2       |             | Census commuting flows (origin to destination) on any geography.                                                                                                                                                                       | New source (Census 2021, OGL) |

### Denominators and summaries

| #   | Priority | Status | Task                                                                                                                                                                                                                                      | Data                                                   |
| --- | -------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 41  | P1       |        | Population for every area, every year, every release, by rebuilding mid-year estimates onto each release. Also widens what conversions can split, since only total population is backtested on a split. Not re-measured since 2026-11-05. | Mostly held; ONS LSOA mid-year estimates fill the gaps |
| 42  | P1       |        | A per-person version of every count measure, naming its denominator.                                                                                                                                                                      | Held                                                   |
| 43  | P1       |        | Summaries of small-area measures for larger areas: population-weighted mean, share of residents in each national decile, spread.                                                                                                          | Held                                                   |
| 44  | P1       |        | Change between periods on fixed boundaries, with changes caused by boundary moves flagged (#414). Now unblocked by task 25.                                                                                                               | Held                                                   |

### Analytical products

| #   | Priority | Status      | Task                                                                                                                                                                                                                                                                                                             | Data                                                                                   |
| --- | -------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 45  | P1       |             | Statistical neighbours: for each council (and ward), the 15 most similar areas across standardised measures, with the measures that drove the match.                                                                                                                                                             | Held                                                                                   |
| 46  | P1       | Done        | Notional election results re-estimated on new boundaries: the 2019 general election on 2024 seats, and local elections on wards new at each review since 2018. Shipped as `modelled` series, open in `politics` and share-alike in `politics-sharealike` (#415, [notional-elections.md](notional-elections.md)). | Held                                                                                   |
| 47  | P2       | Mostly done | Election metrics on fixed boundaries: notional `valid-votes`, `majority` and `party-vote-share-change` per model on the 2024 seats. Swing and marginality follow from them. Left: turnout change, which needs notional electorates.                                                                              | Held                                                                                   |
| 48  | P2       |             | A UK-wide deprivation index on one scale. Stored as `modelled`.                                                                                                                                                                                                                                                  | Held (IMD, WIMD, SIMD, NIMDM)                                                          |
| 49  | P2       |             | Distance from every LSOA or postcode to the nearest GP, school, hospital, station and EV charger, by road where possible.                                                                                                                                                                                        | OS Open Roads and EV chargers held; facilities from NHS ODS, GIAS and NaPTAN (all OGL) |
| 50  | P3       |             | Age-standardised rates for health measures.                                                                                                                                                                                                                                                                      | Partly held                                                                            |
| 51  | P3       |             | Small-area estimates, stored as `modelled` (#433).                                                                                                                                                                                                                                                               | Held                                                                                   |

## Added 2026-11-19

| #   | Priority | Task                                                                                                                                                                                                                                   | Why                                                                                                     |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 52  | P0       | Run the full pipeline in CI on a small fixture release (#409). Check the two `buildData.test.ts` tests that failed on main on 2026-11-08 and fix or remove them.                                                                       | About 1,000 commits landed in two weeks with no end-to-end build in CI.                                 |
| 53  | P0       | Build data off the production server and deploy versioned bundles (#711): atlas, modules, Parquet and the task 24 manifest, published together under one version.                                                                      | Modules exist, but there is no versioned way to ship or roll them back.                                 |
| 54  | P0       | Shrink the v1 API surface before launch (#714).                                                                                                                                                                                        | Early access is the last cheap time to remove routes.                                                   |
| 55  | P1       | A size budget: record each table's size per build (`dbstat`) and fail on unexpected growth. Then shrink `area_location` (89 MB) and stop shipping `crosswalk_edge_check` in the serving file once the API can read it from its module. | `atlas.sqlite` grew from 742 to 942 MB in two weeks.                                                    |
| 56  | P1       | Close the weight gaps: Northern Ireland small-area counts (NISRA data zones or postcodes), Scottish dwellings, and at least one backtest case with its truth in Scotland and one in Northern Ireland.                                  | Nothing in Northern Ireland can be split, and the error factors are untested outside England and Wales. |
| 57  | P1       | Ship uncertainty on converted series (#411). The backtest computes bounds, but no shipped series carries them, and the bounds are wide (median half width 23.69% against a median error of 0.165%).                                    | Customers need to know which converted values to trust.                                                 |
| 58  | P2       | Find published truths on two overlapping sets of areas for other additive measures (jobs, emissions, energy use, pupils) and backtest splitting them.                                                                                  | Only total population is ever split today; each passing backtest unlocks a measure.                     |
| 59  | P1       | Archive downloaded source files (#634), keyed by the release that used them.                                                                                                                                                           | Versioned bundles (task 53) are only reproducible if their inputs are kept.                             |
| 60  | P1       | Host the MCP server with validate, convert and join tools (#635), after tasks 28 and 31.                                                                                                                                               | The way agents reach the database.                                                                      |
| 61  | P2       | Keep this roadmap current: update a task's status in the same PR that changes it.                                                                                                                                                      | This file had fallen two weeks behind main.                                                             |

## Suggested order

1. Before the next deploy: confirm IDs against the deployed file (task 2).
2. Make releases safe: tasks 52, 53, 24 and 59.
3. Make the database answerable by agents: tasks 33, 28 and 31, then 60.
4. Settle the public shape while early access allows change: task 54.
5. Trust in converted values: tasks 34, 57 and 56, then 41 (which feeds 27 and 42).
6. Size: task 55.
7. Remaining precomputations: tasks 26, 27, 35, 43 and 44.
8. New derived products: 36 with 37, 45, 38, then the rest of 39–51.
9. Refactoring alongside: tasks 8–10 and 13.

## Progress notes

- **Task 1** (2026-11-08): the non-exact edges carry weights on up to four
  bases (postcodes, residents, households, dwellings) summed from postcodes
  and output areas. 26 `postcode-overlap` crosswalks give each ward its every
  constituency, where `best-fit` stays the one-to-one lookup. The stages take
  about 2 and 5 minutes and 1 GB. See `data/build/README.md`, "Weights from
  small-area counts".
- **Task 2** (2026-11-08): 15 namespaces, 1.37M keys, 14 MB (3 MB
  compressed), 214 files, one per release for areas, seeded from the
  2026-11-04 build so no existing id changed. Order is stored apart as
  `inventory_position`, and `area_release` is now `id` and `release`. CI
  checks the registries against the base branch. See `docs/stable-ids.md`.
- **Task 3**: `boundary_release` and `boundary_release_country` store registry
  metadata and country coverage. Each release stores the reference year and
  month of its edition, and `boundary_release_edition` answers "which
  snapshot was current on date X?". This orders the held snapshots and is not
  a legal effective-date interval. Four polling dates are recorded in
  `boundary_release_validity`. Missing evidence is not a claim of invalidity.
- **Measure semantics**: `measure` links structured `unit` and `universe`
  references and records `statistic`. Build validation checks aggregation
  components, unit consistency and additive conversion.
- **Task 4**: turnout is weighted by the electorate and background air quality
  by its grid cells, so both are rebuilt. Every other refused rate, share,
  mean and index names the part that is not held (for example the 16 to 64
  population behind the claimant rate).
- **Task 6** (2026-11-15): components of identity crosswalk edges are
  classified as renamed, recoded, split, merged, redistributed, ended or
  created (`pipeline/src/storage/areaChangeClassifier.ts`). 62,294 events and
  71,858 members add 7.5 MB. Dates are edition dates (`date_basis =
'edition'`). Extent continuity crosswalks only link unchanged extents, so
  splits and merges of wards, output areas and parishes show as ended plus
  created. Only the official lookups (local authorities 2022-12 to 2023-05 and
  2024-12 to 2025-05, LSOA 2011 to 2021) hold true splits and merges.
- **Task 10** (2026-11-15): the build fails when a table, view or column has
  no description, or a description names something that does not exist.
  `search` added 25 MB.
- **Task 14** (2026-11-11): `ANALYZE` and `PRAGMA optimize` run on the
  vacuumed copy before it is renamed into place; the atlas and modules pass
  foreign-key and integrity checks. The three indexes and statistics added
  46 MB. A lookup by code fell from 19.0 to 0.013 ms, versions by `area_id`
  from 15.8 to 0.008 ms, edges by `from_version_id` from 35.6 to 0.008 ms.
- **Task 15** (2026-11-11): restoring the index would cost 122.8 MB and does
  not help a place read (0.13 ms per area through the primary key against
  0.14 ms with it, warm cache).
- **Task 25**: 1,438,388 regrouped values and 572 estimated ones, each series
  scored for exact share and coverage. Refused measures and unrouted pairs are
  in `conversion_skip`. The API serves one area's series on a standard release
  with `on=` (`docs/time-series-on-one-release.md`). 963 wards are not carried
  onto the 2026 wards because a ward series by age cannot be split.
- **Task 62** (2026-11-19): `v_observation_default` ranks each quantity's
  series (published, aggregated, modelled with an open model first, converted,
  then a declared dataset order) and reads the best series for each area and
  period with a `NOT EXISTS` on the `observation` key, so no copy of the
  observations is held. It falls through only on a missing row, not on a NULL
  value. The build fails on an undeclared dimension role, on a tie between
  series that share an area and period, and on a repeated quantity, area and
  period (3 s). Measured on a copy of the local release (944 MB), warm: one area
  with every measure 9.3 ms (`v_observation` 85.6 ms); population on 2021
  LSOAs 34 ms (357 ms); households on 2021 LSOAs 218 ms (11.8 s); unemployment
  on 2024 local authorities 10 ms (73 ms). No index was added.
- **Task 33** (2026-11-20): `crosswalk_chain` joins each older release of a
  geography to its current release by the route the converter would take
  (`pipeline/src/conversion/chains.ts`, written by
  `pipeline/src/storage/crosswalkChains.ts`). `crosswalk_chain_edge` holds one
  row per old area and current area with the combined `weight`, `at_risk`,
  `pruned`, `estimated_share`, bounds and a `complete` flag, so an old code
  reaches the current areas in one join through `v_crosswalk_chain_edge`. A
  chain that is exact on every basis is stored once. Stored as tables, since
  a query cannot compose the routes: assembly takes 8 s inside its transaction
  (about 3 s reading the steps, 4 s composing, the rest writing): 140 chains over 891 hops and
  1,218,739 edges, adding 30.7 MB (+3.3%) to `atlas.sqlite`. 214,762 old areas
  lose some or all of their value, listed by `v_crosswalk_chain_gap`; only the
  1,508 that edges cannot show (a named reason, or part of the value still
  arrived) are stored, since an inventory area with no edge and no row is in no
  crosswalk of a step. A chain starts only from the areas in the old release's
  inventory. 19 older releases have no route to the current one and get no
  chain. Ids are in `pipeline/ids/crosswalk-chain.txt`.

## Licence table coverage

`v_source_terms` and `v_election_terms` give the licence flags per source and
per election, which isolates the CC BY-SA 2016–2019 local elections.

Source licence tables cover boundary releases and identify population and
postcode atom inputs for crosswalks and added weight bases. A customer-specific
copy can be created with `pnpm delivery:create`; its `delivery_licence` row
records the supplied customer, order, release and terms independently of the
source licences.
