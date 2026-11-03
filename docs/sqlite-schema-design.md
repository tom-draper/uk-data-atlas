# Canonical SQLite schema design

`atlas.sqlite` stores geography and catalogue statistics as relational rows.
`atlas-cache.sqlite` holds derived search, projection and dataset payload
caches. See `data/build/README.md` for the tables, keys and build stages.

## Statistics model

`source` and `dataset` describe publication and provenance. `measure`,
`dimension` and `dimension_member` describe what is measured. A `series`
binds a dataset, measure, geography release and dimension members. Each
`observation` binds a series to an area version and period, with its value,
status and any bounds or category. `v_observation` joins these tables into a
readable view.

The statistics writer is `packages/atlas-runtime/src/catalogue/atlasStatistics.ts`.
Dataset declarations in
`packages/atlas-runtime/src/catalogue/statisticsDatasets/` identify fields,
dimensions and derived values. The build checks that numeric fields are
accounted for and validates the stored row counts.

`area_relationship` records how a publisher relates one area to another, for
a dataset: `parent` is the area that contains it, `predecessor` an area it was
formed from, and `published-as` the area under whose code the publisher listed
it. Each row names its dataset, so the source and licence are known, and its
two area versions, so the releases are known. It is separate from the
crosswalks, which are computed from boundaries and weights.

The `dataset_part`, `dataset_leaf`, `dataset_record`,
`dataset_record_parent` and `dataset_record_absent` tables describe the
website's dataset payload layouts. The cache holds rebuilt payloads with their
own hashes, and the build compares their values with the compiled datasets.

## API measures and dimensions

`services/api/config/measure-dimensions.json` maps catalogue measure IDs to
statistics measures and dimension members. A dataset ID disambiguates measures
published by more than one dataset. The `statistics-vocabulary` stage derives
labels, parents and ordering from the statistics tables.

`data/build/statistics-read-path.json` maps each observation artifact to a
statistics selector and records the catalogue hash. A selector specifies a
dataset, measure, dimensions and geography. It can also sum dimensions, map
served area codes, derive ratios and totals, calculate confidence bounds, read
contest winners or construct a shared census table. The runtime validates the
selector inventory and catalogue hash before reading observations.

The `data-catalog` stage writes independent compiler artifacts to
`data/build/compiled-observations/`. The `statistics-read-path` stage compares
those artifacts with reconstructed statistics by value, including statuses,
bounds, periods and area codes. The build fails if any artifact cannot be
reconstructed. The compiled artifacts are build inputs, not a runtime fallback.

## Plan for dataset payloads

Replace layout-based reconstruction with dataset-specific generators over
statistics, geography and election rows. Use the existing dataset declarations
to select measures, dimensions and periods, and define the payload fields and
derived calculations that `lib/datasets/` and
`lib/helpers/datasetAggregation/` need. Preserve meaningful ordering and
missing-value semantics, but do not preserve JSON property order or bytes.

Compare each generated payload with its independent compiled dataset by value,
including area identities, periods, values, statuses, bounds and derived
fields. Exercise the website loaders and aggregation with the generated payloads.
Generate cache entries and manifest hashes from the new payload bytes so the
website's immutable URLs still identify the content they serve. Once all
datasets pass these checks, remove `dataset_part`, `dataset_leaf`,
`dataset_record`, `dataset_record_parent`, `dataset_record_absent` and their
layout writer and reader.

Elections need particular care: local and general election payloads combine
observations with contests, candidates and party results, and use several
boundary releases. Historical elections also use constituency identifiers
scoped to a boundary set. NHS waiting times use NHS organisation keys rather
than area codes. Unemployment includes predecessor lists and derived rates,
while population and house prices contain arrays indexed by age or year.
Check that the existing rows retain every field each consumer needs before
removing the layout tables; add domain data where a required fact is missing.

## Dataset declarations

To add a dataset, declare its fields and dimensions in
`packages/atlas-runtime/src/catalogue/statisticsDatasets/`. Each numeric field
must map to a series value or bound, or be documented as derived. Use the
dataset's own periods and geography, and declare alternate releases when
records contain areas from more than one release. Add unit tests for the
declaration and run the built statistics and dataset payload tests after a data
build.
