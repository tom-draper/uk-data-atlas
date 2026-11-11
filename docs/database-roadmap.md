# Database roadmap

Improvements to the precompiled database (`data/build/atlas.sqlite` and its
companions), collected from a review on 2026-11-05. Figures were measured on
the build of that date (`atlas.sqlite` 742 MB). The aim is a database that can
be sold as modules and queried by people and agents, with the boundary
intelligence and crosswalks as its core value.

Priorities: **P0** before selling or exposing SQL to agents, **P1** structure
and product readiness, **P2** cleanup and size, **P3** nice to have.

## Measured state

- 12 of 181 crosswalks carry weights: 7,376 of 1.93M edges (0.4%).
- Ward to constituency (26 crosswalks, 225k edges) is best-fit only. LSOA
  2011 to 2021, output area to anything, and ward to ward across years have
  no weights.
- Task 1 progress (2026-11-08): 98.7% of edges regroup exactly and weigh 1 by
  rule (`v_crosswalk_weight`); the other edges carry weights on up to four
  bases (postcodes, residents, households, dwellings) summed from postcodes and
  output areas. 26 new `postcode-overlap` crosswalks give each ward its every
  constituency, where `best-fit` stays the one-to-one lookup: of 2.16M edges in
  207 crosswalks, 99.96% have a residents weight. Measured on the 2026-11-04
  build; the stages take about 2 and 5 minutes and 1 GB. Left: Northern Ireland,
  Scottish dwellings, the area basis on the new crosswalks, and other families
  as they show a need. See `data/build/README.md`, "Weights from small-area
  counts".
- Task 3 progress: the database build stores boundary registry metadata and country coverage in `boundary_release` and `boundary_release_country`. Catalogue measure mappings and their additional vocabulary are stored in tables, and runtime readers derive the vocabulary from statistics tables. The source supplies coverage years, not authoritative validity intervals; statistics selectors are stored in tables. Four evidence-backed election polling dates are recorded in `boundary_release_validity`; full effective-date intervals and other purposes remain to be verified. Missing evidence is not a claim of invalidity.
- Task 2 progress (2026-11-08): ids are assigned once from append-only
  registries in `pipeline/ids/` (15 namespaces, 1.37M keys, 14 MB, 3 MB
  compressed, 214 files, one per release for areas), seeded from the
  2026-11-04 build so no existing id changed. Order is stored apart as
  `inventory_position`, and `area_releases` is now `id` and `release`. CI checks
  the registries against the base branch. Left: confirm the seed against the
  deployed file (`pnpm ids verify`), and the postcode lookup's own numbering,
  which is internal. See `docs/stable-ids.md`.
- Task 8 progress: the `areas` and `datasets` compatibility views have been removed; postcode and other readers query canonical area tables. Postcode area dictionaries and column-order tables are replaced by row-derived JSON and per-shard integrity hashes. Crosswalk endpoint fields and common metadata are derived by readers, labels come from area versions, and compiled output metadata is held on `dataset`.
- Task 9 progress: selectors are derived from explicit rules and census declarations, and the build no longer writes or compares compiled observation artifacts. The catalogue, place profiles, map values and website regional chunks now read database-derived payloads; direct-to-rows ingestion and the remaining declaration migrations are still outstanding.
- 1,643 series are `published` and 1,093 are `converted` (task 25: every convertible
  measure on the latest authorities, wards, constituencies and 2021 LSOAs, each
  scored for exact share and coverage; 42 refused measures and unrouted pairs
  are in `conversion_skip`).
  See `docs/conversion-accuracy.md`. No `aggregated` series exist.
- 636k of 638k extent-continuity edges are same code, same area.
- Largest objects: `postcodes` 248 MB, `observation` 176 MB plus
  `observation_area` 115 MB, crosswalk edges and diagnostics about 105 MB.
- Observations by module: population 5.8M (63%), housing 1.1M, deprivation
  505k, economy 504k, health 490k, politics 387k, transport 225k,
  environment 111k, education 28k, crime 14k, infrastructure 4k.
- 94% of observation values are whole numbers; 89% sit in near-complete
  (series, period) groups.
- No `sqlite_stat1`: `ANALYZE` has never run on the shipped file.
- SQLite's attach limit is 10 in both the `sqlite3` CLI and `node:sqlite`.

## Core data quality

| #   | Priority | Task                                                                                                                                                                                                                                                                               | Evidence                                                                           |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | P0       | Weight every common crosswalk from the smallest held units (2021 output areas with census population and households, postcode counts), not polygon overlap of large areas. Store several bases per edge: people, households, dwellings, area (`weight_basis` already allows this). | 0.4% of edges weighted. This is the hardest thing for others to copy.              |
| 2   | P0       | Make IDs stable across builds. `release_id` is the release's position in the inventory list and `area_version.id` follows release order, so adding a release shifts every later ID. Assign IDs once, append-only, or make `(geography, release, code)` the public key.             | Breaks customer joins on every update and prevents release diffs.                  |
| 3   | P0       | Make the database self-contained. Move `measure-dimensions.json`, `statistics-read-path.json`, `statistics-vocabulary.json` and the boundary-release JSON payload (dates, coverage, licence) into tables, e.g. `release(valid_from, valid_to, countries, resolution, source_id)`.  | "Which release was current on date X?" can't be answered in SQL today.             |
| 4   | P0       | Complete each measure's aggregation rule. 26 rate, share and index measures have `aggregation = none` and no numerator or denominator. `weighted_mean` has no column naming its weight measure; add `weight_measure_id`. Mark measures that can't be converted, with a reason.     | Rates can't be converted or rebuilt over time correctly without this.              |
| 5   | P0       | Store licences in the database: a normalised licence table with commercial-use and ShareAlike flags. Link boundary releases and crosswalks to `source` (today their provenance is JSON in `crosswalk.header`). Isolate the CC BY-SA 2016–19 local elections.                       | `DATA-LICENCES.md` promises a `licence` table per delivered file; none exists yet. |
| 6   | P1       | Store code changes as dated events in an `area_change_event` table (split, merge, recode, effective date) instead of the JSON `area-lineage` lookup.                                                                                                                               | "What replaced Allerdale?" should be one SQL query.                                |
| 7   | P1       | Add a centroid, bounding box and representative point per area version. Offer GeoParquet boundaries as a module.                                                                                                                                                                   | Only named locations have geometry in the database.                                |

## Structure and maintainability

| #   | Priority | Task                                                                                                                                                                                                                                                                                                                                                                                                  | Evidence                                                            |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 8   | P1       | Stop shaping the schema to rebuild old JSON byte for byte. Make the tables canonical, treat JSON as derived output, then drop `crosswalk.header` (935 KB), `source_fields`/`target_fields`, `crosswalk_label`, `postcode_area_codes`/`postcode_area_columns` (7.8 MB), the old `datasets` table (57 rows beside `dataset`'s 64) and the `areas` view.                                                 | Two kept-in-step representations double the cost of schema changes. |
| 9   | P1       | Collapse each dataset to one compiled form. Today: compiled JSON (`datasets/`, 76 MB), then rows, then a regenerated payload compared with the JSON, plus `compiled-observations/` (75 MB, 322 files) compared again. Finish the declaration migration (15 of about 57 done, see `docs/dataset-declarations.md`), make rows the only output, and use fixture tests instead of whole-build comparisons. | About 6k lines of second compilers, and build time.                 |
| 10  | P1       | One schema definition in code, shared by writer and reader. `SOURCE_FIELDS` is duplicated in `pipeline/src/storage/atlasCrosswalks.ts` and `packages/atlas-db/src/atlasCrosswalks.ts`. Generate the README tables and an in-database `schema_doc` table (description per table and column) from it.                                                                                                   | Lets agents learn the database by querying it.                      |
| 11  | P2       | Consistent naming. Newer tables are snake_case and `STRICT`; `area_releases`, `named_locations`, `postcodes` and `datasets` are camelCase and not `STRICT`. Postcode columns embed release ids (`"ward_2025-05-uk-bgc-v2DistanceCm"`) and need quoting.                                                                                                                                               | Cheapest to fix during early access.                                |
| 12  | P2       | Postcode table design: one column per release (29 area + 29 distance columns), so each new release changes the schema. Use a long table, or map postcodes to output areas only and derive the rest through output-area crosswalks (as the ONS NSPL does). Measure size first.                                                                                                                         | Largest table, 248 MB.                                              |
| 13  | P2       | Store unchanged areas once: "unchanged from release A to B" as a span, not an edge per release. 1M area versions for 307k areas. Do after task 2.                                                                                                                                                                                                                                                     | Roughly 100 MB.                                                     |

## Size and query performance

| #   | Priority | Task                                                                                                                                                                                               | Evidence                                                                                                                                          |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 14  | P1       | Run `ANALYZE` (and `PRAGMA optimize`) at the end of the build. Add indexes for ad-hoc queries: `area_version(area_id)`, `crosswalk_edge(from_version_id)`, `area_relationship(parent_version_id)`. | Lookup by code scans 1M area versions; an edge lookup by area alone is a full scan (220 ms).                                                      |
| 15  | P1       | Drop the `observation_area` index. Readers look up an area through the primary key, passing the series list of the area's release.                                                                 | Saves 115 MB. On a copy: 1.0 ms per area without the index vs 1.6 ms with it (colder cache), so about a tie.                                      |
| 16  | P1       | Ship Parquet (zstd) alongside SQLite for data products. Keep SQLite for apps and the API, which need fast single-row lookups.                                                                      | Observations 291 → 19 MB; edges 59 → 3.5 MB; diagnostics 46 → 7.9 MB; postcodes 248 → 109 MB. Full aggregate over 9.2M rows in 17 ms with DuckDB. |
| 17  | P2       | Move `crosswalk_edge_check` (QA diagnostics) into a QA file, and `website_assets` and `payloads` (app caches) out of the core file.                                                                | About 61 MB, and a pure-data product file.                                                                                                        |
| 18  | P3       | Store postcode distances in metres, not centimetres.                                                                                                                                               | Probably tens of MB (not measured). Centimetres are false precision against generalised boundaries.                                               |

Rejected: storing each series as a packed array per period. It was about
20 MB and made whole-map reads 60× faster (0.09 vs 5.3 ms), but single-area
reads 50× slower (3.9 vs 0.08 ms), and it can't be queried with plain SQL.
Parquet gets the same size and stays queryable.

## Modules

| #   | Priority | Task                                                                                                                                                                                                                                                     |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 19  | P1       | Build modules separately but deliver one assembled SQLite file per purchase, reusing the `assemble-atlas` step. This avoids the 10-database attach limit and keeps foreign keys working. Ship Parquet as one folder per module with a DuckDB views file. |
| 20  | P1       | Core assigns every ID (measure, dimension, period, source), so modules built at different times never clash. Depends on task 2.                                                                                                                          |
| 21  | P1       | Modules point only at core, never at each other. Comparisons that need two optional modules are computed at query time, not stored.                                                                                                                      |
| 22  | P1       | Core lists what every module contains, including unpurchased ones, so an agent can say "this needs the health module".                                                                                                                                   |
| 23  | P1       | Each module has a manifest: version, compatible core versions, sources, licences, row counts and hashes. The assembler refuses incompatible combinations.                                                                                                |
| 24  | P1       | Release manifest and changelog with diffs between releases. Depends on task 2.                                                                                                                                                                           |

Suggested modules:

| Module                                           | Contents                                                                                                                                                         |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| core                                             | Releases, areas, crosswalks with weights, change events, named places, the full catalogue, and denominators (total population, households, dwellings, land area) |
| postcodes                                        | Postcode lookups. Large and useful on their own                                                                                                                  |
| demographics                                     | Full census and single-year-of-age population (63% of observations, so not in core)                                                                              |
| politics                                         | Elections. The CC BY-SA 2016–19 local elections in a separate add-on so ShareAlike doesn't spread                                                                |
| economy, housing, health, education, deprivation | One module each                                                                                                                                                  |
| environment                                      | Environment, transport, infrastructure and crime, merged because each is small                                                                                   |

## Precomputations

| #   | Priority              | Task                                                                                                                                                                                                                                                         |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 25  | P0 once weights exist | Rebuild every measure on a few standard releases (latest local authority, ward and constituency; 2021 LSOA). Each series is `converted`, names its crosswalk and weight basis, and carries a quality score (share from exact regrouping vs estimated split). |
| 26  | P1                    | Roll up every area to its parents (LSOA → MSOA → local authority → region → country), only for measures that can be summed or rebuilt as a ratio.                                                                                                            |
| 27  | P1                    | Rebuild rates from numerator and denominator (per 1,000 residents or households, using core denominators), never by averaging rates.                                                                                                                         |
| 28  | P1                    | A coverage table: measure × geography × release × period, published or converted, so agents can check what's answerable before querying.                                                                                                                     |
| 29  | P3                    | Ranks and deciles within each nation, as views rather than stored values.                                                                                                                                                                                    |

Depends on tasks 1, 2 and 4.

## Attribution of derived data

| #   | Priority | Task                                                                                                                                                                                  |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 30  | P1       | A `series_input` table: for each derived series, its input series, the crosswalk and the weight source. `series.derived_from_id` holds only one input; a converted value has several. |
| 31  | P1       | A `v_series_attribution` view that walks `series_input` back to the original sources and returns every source, publisher, licence and attribution text.                               |
| 32  | P2       | One precomputed, ready-to-print attribution string per series.                                                                                                                        |

## New derived products

Precomputations beyond the tasks above, chosen for what people can't easily
get elsewhere. "Held" means the data is already in the build. Anything
estimated (notionals, the UK-wide index, small-area estimates) is stored as
`modelled`, with its method and inputs recorded, so an estimate never passes
as published data.

Neighbours are currently computed from geometry at request time
(`packages/atlas-loader/src/resolver/spatial.ts`) and are not stored.

### Relationships between areas

| #   | Priority | Task                                                                                                                                                                                                                         | Why                                                                                                        | Data                                |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 33  | P0       | Old code → current code in one step: chain crosswalks across years into direct lookups (e.g. any ward code since 2011 → 2026 wards), combining weights along the chain and recording the accumulated error.                  | People's data is usually on an old release; this puts it on today's boundaries with one join.              | Held                                |
| 34  | P0       | How much each area changed between releases: share of land and share of residents that moved, and a "materially changed" flag.                                                                                               | Tells someone whether old data is still usable on new boundaries, without converting it.                   | Held, once weights exist (task 1)   |
| 35  | P1       | One flat hierarchy table: one row per small area with its parent at every level (OA → LSOA → MSOA → ward → local authority → county → region → country, plus constituency, ICB, police area), each marked exact or best-fit. | The most-downloaded kind of file on the ONS geoportal, and tedious to keep current.                        | Held                                |
| 36  | P1       | Postcode district and sector → official areas, weighted by residential postcodes or population.                                                                                                                              | Insurance, property, retail and marketing data is often only by postcode district or sector.               | Held (ONSPD, postcode counts)       |
| 37  | P1       | GP practice → LSOA, weighted by registered patients (NHS Digital publishes patients per practice by LSOA).                                                                                                                   | Puts all GP-level data (prescribing, QOF, patient survey) onto any geography, using a published weighting. | New source (OGL)                    |
| 38  | P1       | Neighbours stored per release: shared border length, touch-at-a-point flag, coastline length.                                                                                                                                | Spatial statistics, smoothing, neighbouring-council comparisons; removes the runtime calculation.          | Held (geometry store)               |
| 39  | P1       | Population-weighted centroids per area version, from output area or postcode populations.                                                                                                                                    | A better "where people live" point for distances and labels; ONS publishes these for few geographies.      | Held                                |
| 40  | P2       | Census commuting flows (origin to destination) on any geography.                                                                                                                                                             | Commuter zones, and workplace weights for jobs measures.                                                   | New source (Census 2021 flows, OGL) |

### Denominators and summaries

| #   | Priority | Task                                                                                                                                                                                                 | Why                                                                   | Data                                                   |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------ |
| 41  | P0       | Population for every area, every year, every release. Today: local authorities 2011–2024, wards 2022 only, LSOAs at the census. Rebuild mid-year estimates onto each release through the crosswalks. | Every per-person rate and every weight depends on it.                 | Mostly held; ONS LSOA mid-year estimates fill the gaps |
| 42  | P1       | A per-person version of every count measure, naming its denominator.                                                                                                                                 | Raw counts are rarely what people compare.                            | Held                                                   |
| 43  | P1       | Summaries of small-area measures for larger areas: for any LSOA measure, each local authority's population-weighted mean, share of residents in each national decile, and spread.                    | ONS publishes these for deprivation only.                             | Held                                                   |
| 44  | P1       | Change between periods on fixed boundaries: absolute change, percentage change and annual growth, with changes caused by boundary moves flagged.                                                     | Answers "is this change real?" (`services/api/DIRECTION.md`, item 5). | Held, after converted series (task 25)                 |

### Analytical products

| #   | Priority | Task                                                                                                                                                 | Why                                                                                                  | Data                                                                                   |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 45  | P1       | Statistical neighbours: for each council (and ward), the 15 most similar areas across standardised measures, with the measures that drove the match. | Councils benchmark against CIPFA nearest neighbours, which are paid. An open, explained alternative. | Held                                                                                   |
| 46  | P1       | Notional election results: past general and local results re-estimated on new boundaries from ward results and census weights. Stored as `modelled`. | Rallings & Thrasher notionals are proprietary; needed at every boundary review.                      | Held; methodologically hard                                                            |
| 47  | P2       | Election metrics on fixed boundaries: swing, majority, marginality, turnout change.                                                                  | Cheap once notionals exist.                                                                          | Held                                                                                   |
| 48  | P2       | A UK-wide deprivation index adjusting the four national indices to one scale (as mySociety and academics do). Stored as `modelled`.                  | "Most deprived areas in the UK" has no official answer.                                              | Held (IMD, WIMD, SIMD, NIMDM)                                                          |
| 49  | P2       | Distance from every LSOA or postcode to the nearest GP, school, hospital, station and EV charger, by road where possible.                            | Government journey-time statistics stopped in 2019.                                                  | OS Open Roads and EV chargers held; facilities from NHS ODS, GIAS and NaPTAN (all OGL) |
| 50  | P3       | Age-standardised rates for health measures, using single-year-of-age population.                                                                     | Fair comparison between old and young areas.                                                         | Partly held: needs counts by age, which few datasets have                              |
| 51  | P3       | Small-area estimates, e.g. council figures spread to LSOAs with covariates. Stored as `modelled`.                                                    | `services/api/DIRECTION.md`, item 7.                                                                 | Held                                                                                   |

Top five: tasks 33, 41, 34, 36 with 37, and 45.

## Suggested order

1. Quick wins: tasks 14 and 15.
2. The public shape, while early access allows change: tasks 2, 3, 5 and 20.
3. Make the crosswalks the product: task 4, then 1, then 25.
4. Modules and distribution: tasks 19–24 and 16.
5. Remaining precomputations and attribution: tasks 26–31.
6. New derived products, top five first: tasks 33, 41, 34, 36, 37 and 45,
   then the rest of 35–51.
7. Refactoring alongside: tasks 8–10, easier once rows are the only compiled form.

### Licence table coverage

Source licence tables cover boundary releases and identify population and
postcode atom inputs for crosswalks and added weight bases. A customer-specific
copy can be created with `pnpm delivery:create`; its `delivery_licence` row
records the supplied customer, order, release and terms independently of the
source licences.
