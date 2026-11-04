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
the publisher's text: area name, region, country, constituency type and result.
Its two leading parties and the party declared the winner are `party` ids. A
`party` is one row whichever way it is written: `code` is the publisher's
abbreviation (`Lab`) and `key` the atlas's key for it (`LAB`, the abbreviation
in upper case). A winner with no abbreviation, such as `OTHER`, is stored under
its key. `name` and `colour` come from the dataset's declaration; a party it
does not name has its code as its name. `result` is kept as published (`Lab
gain from Con`) and not parsed, because nothing reads a part of it. `v_contest`
reads a contest back with the party codes and winner key. `candidacy` holds the
candidate a contest elected. Votes, electorates and turnout are observations
dated on the polling day. The build refuses to publish if a contest's winner
differs from its `source-winning-party` observation.

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

## Dataset payloads

The website still reads a JSON payload per dataset. It is generated from the
rows by `packages/atlas-runtime/src/catalogue/declaredPayload.ts`, using each
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
`dataset_area_name` and `dataset_area_key`. Figures that are aggregates of
observations, such as a referendum's winning answer, a district's deprivation
summary or an area's largest ethnic group, are computed when the payload is
generated and stored nowhere. Fixed text, such as a table's source note, sits
in the dataset's declaration.

## Dataset declarations

To add a dataset, declare its fields and dimensions in
`packages/atlas-runtime/src/catalogue/statisticsDatasets/`. Each numeric field
must map to a series value or bound, or be documented as derived. Use the
dataset's own periods and geography, and declare alternate releases when
records contain areas from more than one release. Add unit tests for the
declaration, and give it a `payload`. Run the built statistics and dataset
payload tests after a data build.
