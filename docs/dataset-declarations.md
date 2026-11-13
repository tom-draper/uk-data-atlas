# Dataset declarations

One module per dataset. This note records where a dataset is described today,
the shape that replaces it, the order datasets move in, and what stays custom.

How datasets are grouped (themes, topics, classification rules, download
modules and folder layout) is defined in `docs/data-organisation.md`, and the
registry in `packages/datasets/src/declaration/taxonomy.ts`. This note covers
only the shape of a declaration and how datasets move to it.

## Current state

A dataset is described in separate places that nothing keeps in step:

| Place                                                                                            | Holds                                                                                       |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `packages/datasets/src/data/<name>/loader.ts`                                                    | Reads raw files into the compiled payload                                                   |
| `packages/datasets/src/data/catalog/definitions/<camelCase>.ts`                                  | Manifest `type`, output file, boundary type, source and licence, loader hook                |
| `packages/datasets/src/types/<camelCase>.ts`                                                     | Types of the compiled payload                                                               |
| `packages/measures/src/statisticsDatasets/*.ts`                                                  | Statistics declaration of the datasets not yet declared (see Migration status)              |
| `pipeline/src/catalog/<name>.ts`, `compileDataCatalog.ts`                                        | A second compiler for the API catalogue: indicator ids, units, notes, boundary year, period |
| `pipeline/src/stages/build-data-catalog.ts`                                                      | Input file per dataset                                                                      |
| `pipeline/src/statistics/bindCompiledFields.ts`                                                  | API measure id to dataset field                                                             |
| `services/api/config/measure-dimensions.json`                                                    | API measure id to statistics measure and dimension members                                  |
| `services/api/config/statistics-vocabulary.json`                                                 | Measure vocabulary (a snapshot of the declarations)                                         |
| `packages/measures/src/catalogueUnits.ts`                                                        | Which unit strings are counts                                                               |
| `lib/datasets/<camelCase>.ts`                                                                    | Website chart definition: topic, key, label, card, map value, colour range, legend          |
| `lib/datasets/generated.ts`, `generatedCharts.tsx`                                               | Generated registries over the files above                                                   |
| `lib/types/datasets.ts`, `lib/types/mapOptions.ts`                                               | One entry per dataset in the dataset and map option records                                 |
| `lib/config/mapOptions.ts`                                                                       | Default map options, with an `if (type === ...)` per dataset                                |
| `lib/helpers/datasetAggregation/*`                                                               | Aggregation functions and one specification per dataset                                     |
| `components/LegendContent.tsx`, `LegendPanel.tsx`, `legend/*`                                    | Per-dataset legend and measure toggle                                                       |
| `lib/atlas/figures.ts`, `rankingRecipes.ts`, `rankings.ts`, `pages.ts`, `scripts/map-figures.ts` | Place figures, ranking recipes and labels, keyed by dataset id                              |
| `lib/reference/datasets.ts`, `lib/docs/content/data.ts`                                          | Reference copy and docs topics                                                              |
| `lib/places/headlines.ts`                                                                        | Place headline per dataset                                                                  |

### Claimant count

It has three ids: the manifest `type` `claimantCount` (payload header, website
keys, map options), the file and dataset slug `claimant-count` (SQLite, API,
files), and the measure `claimants` (statistics vocabulary). The API adds two
indicator ids, `claimant-count` and `claimant-count-16-to-24`. About thirty
files name it:

- Loader and definition: `data/claimant-count/loader.ts`,
  `catalog/definitions/claimantCount.ts`, `types/claimantCount.ts`.
- Statistics: the `statistics` block of its declaration (measures, age-group
  dimension, fields, header, `derived` youth rate).
- API: `pipeline/src/catalog/claimantCount.ts` (indicators, notes, boundary
  year 2024, period `2026-04`), `compileDataCatalog.ts`, `build-data-catalog.ts`,
  `bindCompiledFields.ts`, `measure-dimensions.json`, `statistics-vocabulary.json`,
  `catalogueUnits.ts`.
- Website chart: `lib/datasets/claimantCount.ts`, `components/economics/claimant-count/ClaimantCountChart.tsx`,
  `generated.ts`, `generatedCharts.tsx`.
- Website options and legend: `lib/types/mapOptions.ts`, `lib/config/mapOptions.ts`,
  `LegendContent.tsx`, `LegendPanel.tsx`, `LegendSupplementalPanels.tsx`.
- Aggregation and figures: `specifications.ts`, `numeric.ts`, `lib/atlas/figures.ts`,
  `rankingRecipes.ts`, `rankings.ts`, `pages.ts`, `scripts/map-figures.ts`,
  `lib/places/headlines.ts`, `lib/reference/datasets.ts`, `lib/docs/content/data.ts`.

### House price

Same layout: `data/house-price/loader.ts` and `wardCodes.ts`, the definition and
types, the economy statistics declaration, `pipeline/src/catalog/housePrice.ts`
(a ward partition with its own last-period constant), `measureAliases.ts`,
`measureStatisticsSelections.ts`, `lib/datasets/housePrice.ts`,
`HousePriceChart.tsx`, `housePriceSeries.ts`, the `measure.housePrice` URL
parameter in `mapOptionsUrl.ts`, `housePrice` entries in the map option types
and defaults, `ChartCards.tsx`, aggregation, figures, rankings and docs.

### Local election

The same again, plus custom website code: `components/elections/local/*`,
`lib/helpers/localElection.ts`, `mapRendering/elections.ts`,
`useLocalElectionDatasets.ts`, `legend/CategoryLegends.tsx`, `legendData.ts`,
`PlaceElections.tsx`, and pipeline `catalog/elections.ts`,
`electionStatisticsExport.ts` and `datasetRegionChunks.ts`.

## Target shape

Each dataset is one module, `packages/datasets/src/<theme>/<topic>/<id>/dataset.ts`,
exporting a `DatasetDeclaration`. `<id>` is the only identifier: kebab-case,
used for the API, pipeline, files, SQLite slug and website.

```ts
export const claimantCount = defineDataset<ClaimantCountDataset>({
	id: "claimant-count",
	topic: "labour-market",
	source: { name, publisher, sourceUrl, licence, licenceUrl, attribution,
	          description, year, cadence, notes },
	boundary: { type: "localAuthority", year: 2024 },
	load: ({ text, xlsxSheet }) => loadClaimantCount(text, xlsxSheet),
	statistics: { measures, dimensions, fields, derived, computed, ... },
	catalogue: { kind: "indicators", period, indicators: [/* API measures */] },
	display: { label, year, card, measures: [/* rate, count */], aggregation },
});
```

`pnpm data:build --only catalogue-registry` finds every
`<theme>/<topic>/<id>/dataset.ts` and writes `data/declarations.ts`, the catalogue
registry and the dataset record types from them.

- It extends the existing `DeclaredDataset` (the statistics declaration) rather
  than replacing it. The declaration types and the `periods`, `measure` and
  `yearParts` helpers move to `packages/datasets` so a declaration can sit
  beside its loader.
- `topic` is required: the one registered topic the dataset is filed under.
  `related` is an optional list of other topics, never the primary. The module
  is derived from the topic (`moduleOfTopic`) and written to `dataset.module`
  in `atlas.sqlite`; it is not set by hand.
- Everything that used to be a second copy reads the declaration: the API
  catalogue compiler, the field bindings, the manifest and registry, website
  chart and map options, legend, ranking labels and place figures.
- Display hints are data. A measure toggle (rate or count) is
  `display.measures: [{ id, label, field, colorRange, legend, card }]`, so the
  legend, the toggle panel and the default map options are built from it. A
  dataset whose chart is more than one headline value names its own component
  in `display.component`; the website looks it up from the declaration.
  A rank is written with the `rank` format ("Most deprived" to "Least
  deprived") and keeps low values at the low end of the colour scale with
  `invertColor: false`; an aggregation that must count each area once however
  many boundary features carry its code sets `distinct`.
- `catalogue.indicators` is the API catalogue: each indicator names its
  measure id, the compiled field, the statistics measure and the fixed
  dimension members. The API's measure-to-dimension mapping and the pipeline's
  field bindings are read from it, so `measure-dimensions.json` lists only
  ids no declaration publishes.

### Themes, topics and modules

Themes, topics and modules are defined in `docs/data-organisation.md`. The
module table that was here is superseded: `crime` and `deprivation` are topics
of the `society` theme, `population` and `infrastructure` keep their names, and
`core` splits into `core`, `boundaries` and `postcodes`.

## Migration order

1. Done: a primary `topic` on every dataset, with `dataset.module` derived
   from it and tests (`docs/data-organisation.md`, task 2). The census small
   area tables and fuel poverty are filed the same way. `land-area` is
   provisionally filed under `emissions` because no registered topic fits it.
2. Move the declaration types and helpers to `packages/datasets`; add
   `DatasetDeclaration`, `declareDataset` and the registry. A test requires
   every catalogue dataset to have one declaration with a unique id, a valid
   module and a licence. Datasets not yet moved are listed explicitly in the
   test and removed from that list as they move.
3. Pilot: claimant count moves fully and its scattered definitions are
   deleted. The API catalogue compiler, field bindings, and website options
   read its declaration generically.
4. Batches by theme, one or a few commits each, deleting old definitions as
   each dataset moves: economy first (it shares the claimant count shapes),
   then housing, then the rest.
5. Delete the leftover generic scaffolding: per-dataset switch statements, maps
   keyed by dataset id, duplicate notes and boundary years.
6. Update `ARCHITECTURE.md` and the dataset docs.

## What stays custom

- Loaders: real code per source, now next to the declaration.
- Aggregation maths that is not a sum or weighted mean, as a pure function in
  the declaration.
- React components that are not a value card or choropleth: the election charts
  and result maps, ethnicity, population pyramids, and the house price series.
  The declaration names the component and the website looks it up by id.

## Migration status

Every dataset is a declaration in
`packages/datasets/src/<theme>/<topic>/<id>/dataset.ts`. A test checks that the
folder matches the declared theme, topic and id. The statistics entries of
declared datasets are built from their declarations (`statisticsOf`).

The four politics datasets, `ethnicity`, `population`, `house-price`,
`life-expectancy` and `fuel-poverty` are declared, but their maps are not drawn
from a display: party colours, the Leave share scale, one chart per election,
the ethnicity categories and the population age, gender and density views, the
house price series, the life expectancy male, female and average views and the
fuel poverty ward and local authority summary are website code. Each keeps a
hand-written `lib/datasets/<name>.ts` that spreads `definitionOf(<declaration>)`
and adds its renderer, legend kind and charts. Shared links keep the old
`generalElection`, `localElection`, `brexitConstituency`, `fuelPoverty`,
`housePrice` and `lifeExpectancy` names in the map option parameters.

A dataset that stays on a camelCase website key (`type`) until it moves is the
only place an old id survives; all declared datasets use their kebab-case id
everywhere.

Declared metadata that was derived rather than researched: `attribution` comes
from the publisher, `cadence` from a table in the migration script, and `notes`
is empty. Review these per dataset when its docs page is written.
