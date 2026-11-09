# Website measure queries

How the website should read statistics: ask a shared query layer for the
values of a measure, and let the measure's value kind, unit and dimensions
decide how to draw them. This document records how the website loads and
aggregates data today, what the API already provides, the target, and the
order of the migration. Phase 1 (this change) adds the query layer, a website
data path and one proof. Nothing existing is switched over yet.

## Current state

### How the website loads data

Each of the 48 chart datasets (`lib/datasets/*.ts`, registered in
`lib/datasets/generated.ts`) is one whole JSON payload.

1. `atlas-sqlite` stores the statistics rows (`series`, `observation`,
   `measure`, `dimension`) in `data/build/atlas.sqlite`.
2. The same stage regenerates each dataset's old-shape JSON payload from those
   rows (`packages/atlas-runtime/src/catalogue/declaredPayload.ts`), compares
   it with the independently compiled dataset by value, and stores it gzipped
   in `data/build/atlas-cache.sqlite`.
3. The Next.js server passes the browser a map of dataset output names to
   `/data/catalogue/<sha256>/<output>.json` URLs
   (`app/data/catalogue/[sha256]/[output]/route.ts`). The URL is immutable and
   the bytes are the stored gzip.
4. `lib/hooks/useDatasets.ts` fetches a payload for every dataset the active
   map or a visible card needs. Large datasets are cut into regional chunks
   (`lib/data/datasetRegionChunks.ts`) and merged in the browser.

So the browser downloads per-dataset records (every area, every period, every
field), not the values it will draw.

### How the website aggregates

Each dataset owns a `ChartDefinition.calculateStats` that calls
`DatasetAggregator.aggregate` with a specification from
`lib/helpers/datasetAggregation/specifications.ts`. A specification takes the
currently loaded boundary features, finds the area code property, collects the
dataset's records for those codes and combines them: a sum for counts, a
weighted mean for rates, a bespoke fold for elections, age bands and ethnicity
(`numeric.ts`, `population.ts`, `demographics.ts`, `economics.ts`,
`elections.ts`). The result is a dataset-specific `Aggregated…Data` shape that
the chart component, legend and value card each read.

Three things follow:

- The aggregation rules live in the browser, once per dataset, and repeat what
  each measure already declares in the catalogue (`sum`, `weighted-mean`,
  `non-aggregatable`).
- The map reads `ChartDatasetMap.valueKey` and a hand-written legend, so a new
  measure needs new code in `lib/datasets`, `lib/config/mapOptions.ts`,
  `lib/types` and a chart component before it can be drawn.
- Boundary geometry and values arrive separately (PMTiles plus a properties
  sidecar, then the dataset payload), and the join is by area code in the
  browser.

About 56 files import `datasetAggregation` and 53 define `calculateStats`.

### What the API provides

The API (`services/api`) reads the same statistics rows through the shared
runtime package (`packages/atlas-runtime`):

- **Reader.** `ObservationCache` (`catalogue/observationTables.ts`) rebuilds a
  measure source's observation artifact from the statistics rows using the
  selector recorded in `statistics-read-path.json`
  (`catalogue/atlasStatisticsObservations.ts`). `lazySourceObservations` exposes
  it as an artifact with one block of records per period, parsed on first use.
  `observationsFor` finds a source's period.
- **Measures and dimensions.** A catalogue measure id such as `crime-burglary`
  is one series of a measure (`recorded-crimes`) with dimension members fixed.
  `services/api/config/measure-dimensions.json` maps each catalogue id onto
  that, and `dimensionCatalogue` (currently
  `services/api/src/dimensions/dimensionCatalogue.ts`) builds the dimensional
  view: measures, dimensions with members and a total, and the series that
  realise them.
- **Series selection.** `selectSeries` (`dimensions/seriesSelection.ts`) turns
  a measure and dimension filters into series: a dimension left out takes its
  total, a reviewed default breaks ties, `*` keeps every member. `measure=` with
  dimension query parameters (`?measure=recorded-crimes&offence=burglary`) is
  rewritten to catalogue ids by `dimensions/measureQuery.ts`.
- **Routes.** `/v1/data/{measure}` (observations), `/series`, `/rankings`,
  `/value`, `/change`, `/compare`, `/convert`, `/aggregate`, the hash-pinned
  whole-measure export `/v1/data/{measure}/export` (CSV or Parquet), and
  `/v1/map-resources/{geography}/{release}/join/{measure}` (values numbered to
  match tiles). They resolve a source partition with `defaultSource`
  (`dataDefaults.ts`) and `selectSourcePartition`, and read records with
  `observationsFor`.
- **Aggregation.** `/aggregate` sums the member observations of a resolved
  target (`aggregateTargetMembers.ts`) or takes a weighted mean
  (`weightedMean.ts`, `weightedAggregation.ts`). A measure declares
  `aggregation` as `extensive` (sum), `intensive` (weighted mean with a named
  weight), `categorical` or `non-aggregatable` (a median, rank, decile or life
  expectancy), with an `available` flag. A weighted mean is refused when the
  value and weight partitions differ.

What the API does not give the website: a bulk read of one measure's values for
a set of areas and periods in a compact shape suited to drawing, and no route in
the website's own process. The website never calls the API at runtime
(ARCHITECTURE.md), and it must not import API project code.

## Target

The website asks for values, not payloads:

```text
measure + dimension filters + geography + boundary year + periods (+ areas)
  → area codes, values and statuses per period, plus the measure's metadata
```

Charts, the legend and the map fill are chosen from the metadata:

| Metadata                 | Drives                                                                 |
| ------------------------ | ---------------------------------------------------------------------- |
| `valueKind`              | Sequential or diverging scale, number format, which chart is offered   |
| `unit`                   | Legend and tooltip labels                                              |
| `dimensions` and members | Which selectors to show, which member is the default, breakdown charts |
| available periods        | The period control and time series                                     |
| `aggregation`            | Whether a parent area can show a value, and by which rule              |
| `uncertainty`            | Whether to draw intervals                                              |

Custom components stay where they add something real: election results (party
colours, winners, seat counts), the population pyramid and ethnicity
compositions (a whole breakdown at once), and anything that draws geometry the
generic map cannot.

## The query shape

One function in `packages/atlas-runtime/src/catalogue/measureValues.ts`:

```ts
queryMeasureValues(context, request): MeasureValuesResult
```

Request:

| Field          | Meaning                                                                           |
| -------------- | --------------------------------------------------------------------------------- |
| `measure`      | A measure id (`population`), or a catalogue series id                             |
| `dimensions`   | Filters by dimension id; a dimension left out takes its total or reviewed default |
| `datasetId`    | Chooses between datasets that publish the same members                            |
| `geography`    | The source geography level, such as `localAuthority`                              |
| `boundaryYear` | The release (code year) of that geography                                         |
| `periods`      | Periods wanted; default is the source's latest                                    |
| `areas`        | Optional area codes to keep                                                       |
| `parents`      | Optional `{ code, memberCodes }` groups to aggregate children onto                |

Result: the measure (label, `valueKind`, `unit`, aggregation rule, dimensions
with members, uncertainty), the series read, the source partition and its
available periods, then columns by period holding `values`, a `status` code per
area and, where the publisher gives them, `lower` and `upper`. Areas with no
record carry `null`. A request the data cannot answer returns a typed problem
(`unknown_measure`, `unknown_dimension`, `unknown_dimension_member`,
`no_matching_series`, `ambiguous_series`, `ambiguous_source`, `unknown_period`,
`aggregation_not_supported`, `partial_coverage`) with the status the API would
use, so the API can map it to its problem responses unchanged.

Aggregation onto `parents` follows the measure's declaration: a sum for an
extensive measure (a parent with missing members is `partial`, not silently low),
a weighted mean for an intensive measure whose weight is a served measure on the
same partition, and `aggregation_not_supported` otherwise, with the API's
wording. It reuses the API's `calculateWeightedMean`.

Membership of a parent (which wards are in a council) is an input, not looked
up here: the API resolves it from crosswalks, and the website will supply it
from its lineage lookups in a later phase.

### Reuse, not a second reader

The function reads through `observationsFor` over the same lazily rebuilt
observation artifacts the API serves, selects series with the same logic
`selectSeries` now calls, and aggregates with the same weighted mean. The
dimension catalogue and the pure series matching move into the runtime package;
the API imports them from there.

### Website data path

`GET /data/measures/{measure}` (a Next.js route handler) calls
`queryMeasureValues` in-process and returns the result in columnar form: one
shared `areas` array, one `values` array per period, small integer `status`
codes into a `statuses` legend. Dimension filters are `dimensions[<id>]=a,b`;
`geography`, `boundaryYear`, `period` and `areas` are plain parameters. The
response carries an `ETag` and `Cache-Control: public, max-age=300,
stale-while-revalidate=86400`. The URL is not content addressed because the
filters are open ended, so the ETag (a hash of the body) lets a repeat request
cost a 304. The server keeps a bounded memo of recent bodies keyed by the
database file's generation, so a replaced database never serves stale values.

`lib/measures/` holds the typed client: request builder, response type,
decoder to rows, and a hook. The server needs the data catalogue, the read
path, the vocabulary and the reviewed dimension mapping on disk next to
`atlas.sqlite` (all produced by `pnpm data:build`), so the route's tracing
includes them. This is one new dependency of the website on build output
besides the two databases, and it is the open question for phase 2: either
accept it, or have `atlas-sqlite` store the catalogue and read path in the
database.

### Coverage gap

The query layer serves the catalogue's measures, because that is what the API
reads and what `services/api/config/measure-dimensions.json` maps onto
dimensions. The statistics tables hold 95 measures and the mapping covers 51.
The other 44 are not catalogue measures yet, including child poverty,
fuel poverty, claimant rate, electorate, imd scores and several health and
school measures. Phase 2 cannot switch a dataset until its measure is in the
catalogue and the mapping, so adding them is part of each dataset's move, and
the reason the proof uses `population`, which is mapped.

## Migration

Phase 1 (this change): the query layer, the route and client, and one proof,
`population` for local authorities, drawn by a generic component on a
development-only page (`/dev/measure-proof`, a 404 in production unless
`MEASURE_PROOF=1`). Nothing
in `lib/datasets`, `lib/helpers/datasetAggregation`, `lib/config/mapOptions.ts`,
`lib/types`, `lib/atlas/figures.ts`, the legend or the per-dataset charts is
touched, because the dataset declarations work is changing them.

Phase 2, after the dataset declarations change merges (each dataset's
declaration then states its measure, so the switch is a line per dataset):

1. Map colouring and the legend from measure metadata, for datasets that have a
   single numeric measure with no custom renderer. Ten datasets declare a
   `valueKey` and no `mapRenderer` today: crime, child poverty, housing
   affordability, adult social care activity and outcomes, net additional
   dwellings, council tax, school performance disadvantage, the deprivation
   rank maps and local government finance. The others need a renderer for
   their own reasons and move later.
2. Value cards and generic charts (ranked bars, distribution, time series, with
   intervals when `uncertainty` is set) replacing the per-dataset chart
   components for the same datasets.
3. Parent-area figures (`lib/atlas/figures.ts`, map headlines and rankings)
   from `parents` aggregation, once the website can supply membership.
4. Datasets with dimensions (crime type, tenure, car availability, travel to
   work): dimension selectors from the metadata, then breakdown charts.
5. Delete `lib/helpers/datasetAggregation`, the per-dataset `calculateStats`,
   and the regional chunk payloads they used; stop serving the
   `/data/catalogue/<sha256>/<output>.json` route and the payload generation
   in `atlas-sqlite`.

Stays custom: general and local elections (party winners, seats, vote share by
party), population age and gender pyramids, ethnicity compositions, the claimant
count timeline with its bespoke annotations, road safety and air-quality grids,
and the postcode and place pages.

## Relation to the dataset declarations work

`refactor/dataset-declarations` consolidates each dataset into one declaration
(definition, chart, map, aggregation) in `packages/datasets`. This work is
complementary: the declaration says which measure a dataset draws, and the
query layer supplies its values. Phase 2 starts from the merged declarations,
reads the measure id and dimension members from them and replaces
`calculateStats` and `valueKey`. Until then the two share no files.

## Measured

Taken once, read-only, against the 4 November data build in the main checkout
(`atlas.sqlite` before payload compression), with `queryMeasureValues` called
in-process. This worktree has no build of its own. The route adds JSON
serialisation and an HTTP hop to these figures but no more reads.

| Request                                                 | JSON bytes | Gzip bytes | Time                |
| ------------------------------------------------------- | ---------: | ---------: | ------------------- |
| `population`, local authority 2023, latest period (361) |      8,268 |      2,568 | 615 ms cold, 0.4 ms |
| `population`, local authority 2023, all 14 periods      |     50,080 |     18,205 | 1.5 ms warm         |
| Current `population` dataset payload, whole file        |  7,333,784 |  2,331,669 | not timed           |

The cold time is the first read of that measure's observations from the
statistics rows; later requests reuse the observation cache. The current
payload is not like for like: it holds wards, age bands and every area the
population dataset draws, which the proof does not need. What it shows is that
a chart or map that wants one measure for one geography no longer pays for the
rest. Loading the context (catalogue, mapping, read path) took 16 ms.

The route's own latency, browser parse time and the map were not measured.

## Measuring the change

To repeat: build the data, then time `/data/measures/population?geography=localAuthority&boundaryYear=2023`
against the `population` dataset payload and its regional chunks.
