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

The `dataset_part`, `dataset_leaf`, `dataset_record`,
`dataset_record_parent` and `dataset_record_absent` tables describe the
website's dataset payload layouts. The cache holds rebuilt payloads, and the
build checks their hashes against the dataset manifest.

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

## Dataset declarations

To add a dataset, declare its fields and dimensions in
`packages/atlas-runtime/src/catalogue/statisticsDatasets/`. Each numeric field
must map to a series value or bound, or be documented as derived. Use the
dataset's own periods and geography, and declare alternate releases when
records contain areas from more than one release. Add unit tests for the
declaration and run the built statistics and dataset payload tests after a data
build.
