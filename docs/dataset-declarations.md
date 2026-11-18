# Dataset declarations

A dataset is described in one file, its declaration:
`packages/datasets/src/<theme>/<topic>/<id>/dataset.ts`, which exports the
result of `defineDataset(...)`. `<id>` is the only identifier: kebab-case, used
for the API, the pipeline, the files, the SQLite slug and the website. A test
checks the folder against the declared theme, topic and id.

How datasets are grouped (themes, topics, classification rules, download
modules and folder layout) is in `docs/data-organisation.md`. This note covers
the shape of a declaration, what is generated from it, and what still lives
outside it.

## What a declaration holds

The type is `DatasetDeclaration` in `packages/datasets/src/declaration/dataset.ts`.

| Field                                                           | Describes                                                                                                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `id`, `topic`, `related`                                        | Identity and filing. The module and theme are derived from the topic, never set by hand.                                             |
| `source`                                                        | Name, publisher, source URL, licence and its URL, attribution, description, edition year, update cadence, notes.                     |
| `boundary`, `additionalBoundaryTypes`, `coverageCountries`      | The geography and boundary release the records are keyed by, and the nations the source can cover.                                   |
| `load`, `ingestion`, `layout`                                   | How the sources are read (`noCompiledPayload()` for a dataset read straight into rows) and the checks on what the reader returns.    |
| `statistics`                                                    | Measures, dimensions and their members, the field of each record that is each series, derived fields, periods and payload header.    |
| `catalogue`                                                     | The measures the API publishes: id, label, unit, value kind, aggregation, notes, the statistics measure and fixed dimension members. |
| `display`, `mapViews`, `categories`, `ranking`, `placeHeadline` | How the website draws the dataset: card, map colouring, legend, measure toggle, ranking labels and the place page headline.          |

The parser (`load`, or `statistics.direct.read`) is real code and stays beside
the declaration's imports. Everything else in the table is data.

## What is generated or derived from it

- `pnpm data:build --only catalogue-registry` finds every `dataset.ts` and writes
  `data/declarations.ts`, `data/catalog/registry.ts` and `data/catalog/generated.ts`
  (the manifest definitions and the dataset record types). Those files are
  generated and checked in.
- `definitionOf` turns a declaration into the manifest definition the dataset
  compiler reads. `statisticsOf` turns it into the statistics declaration the
  rows are written and read back from (`packages/measures/src/statisticsDatasets`).
- `catalogue` is read by `pipeline/src/catalog/declaredIndicators.ts`, which
  publishes the API measures and their observation artifacts.
- `display`, `mapViews`, `categories`, `ranking` and `placeHeadline` are read by
  `lib/datasets/declared.ts`, `lib/datasets/categories.ts` and
  `lib/places/headlines.ts`, so a dataset that fits the shared card and map
  needs no website code.

## Validation

`defineDataset` runs `declarationProblems`
(`packages/datasets/src/declaration/validate.ts`) when the module is first
imported, so an invalid declaration fails typecheck, tests and every build
stage rather than reaching a table or a page. It rejects:

- an empty source term, a URL that is not http(s), or an unknown cadence;
- a repeated or unlabelled measure, dimension or member, and a member whose
  parent is not a member;
- a field that reads a measure or binds a dimension the declaration does not
  declare;
- a catalogue indicator that names an undeclared measure, dimension or member,
  repeats another indicator, or reads a field that the declaration gives a
  different series;
- a catalogue with no period (or `yearly`), no coverage note, or a stateful
  authority pattern;
- a display with repeated measure ids or an empty colour range or legend, and a
  place headline with no places.

`tests/data/declarationValidation.test.ts` checks that every declared dataset
passes and that each rule rejects a faulty copy of a real declaration.

## The API catalogue

`catalogue: { kind: "indicators", ... }` replaces a per-dataset compiler in
`pipeline/src/catalog`. Besides the indicators it sets:

- `period` for a file of one period, or `yearly` for a file with an entry per year;
- `codes`, the set of authorities every record must belong to (`authorities` of
  the population estimate, or `england2025`), so any authority without a value is
  named in the coverage note;
- `authorityCodes`, a pattern for tables that interleave counties or regions
  with their authorities;
- `mergeApril2023`, to reduce the April 2023 authorities and the districts they
  replaced to authorities.

The dataset's `source.notes` are published with every indicator.

## Adding a simple dataset today

1. Write `<theme>/<topic>/<id>/dataset.ts` and its source parser.
2. Run `pnpm data:build --only catalogue-registry` and `pnpm ids`.
3. Add the three registry entries listed below.

A dataset whose payload is a single value per authority can use
`IndicatorDataset<"<id>">` as its payload type (see `waste`) instead of a new
type file.

## Still described outside the declaration

These are the places left that name a dataset. Each is a follow-up to #708, in
roughly the order it is worth doing.

| Place                                                                                                                                                                                   | Holds                                                                        | Plan                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `declaration/guides.ts`                                                                                                                                                                 | Title, topic, about and summary of each dataset, for the docs pages          | Move into the declaration and generate. The registry entry point must stay free of loaders, so it needs a generated file. |
| `declaration/sources.ts` and `declaration/sourceDatasets.ts`                                                                                                                            | The topic again, the source folder and which datasets it feeds               | Generate from the declarations. Loaders import `sources.ts`, so a declaration cannot import it back.                      |
| `pipeline/src/catalog/*.ts` (road collisions, crime, air quality, unemployment, jobs, emissions, GDP, energy, population, house price, life expectancy, deprivation, elections, census) | Indicator ids, units, notes, period and boundary year, written as a compiler | Move into `catalogue`, extending it where a dataset has several partitions or a derived status.                           |
| `pipeline/src/statistics/bindCompiledFields.ts`                                                                                                                                         | Indicator id to dataset field for those compilers                            | Delete as each compiler moves.                                                                                            |
| `lib/atlas/pages.ts` (`MAP_NAMES`)                                                                                                                                                      | The name of each map, defaulting to `source.name`                            | Move into `display`.                                                                                                      |
| `lib/atlas/rankingRecipes.ts`, `lib/atlas/figures.ts`, `scripts/map-figures.ts`                                                                                                         | Ranking columns and place figures, mostly code                               | Declare the simple ones, keep the rest as code (website generic over measures, #709).                                     |
| `types/<name>.ts`, `types/index.ts`, `packages/datasets/src/index.ts`                                                                                                                   | Payload types and re-exports                                                 | Payload types stay with the parser. The re-exports could be generated.                                                    |

Some places name datasets but are not descriptions: `pipeline/ids/*.txt` (the
permanent id registry), `pipeline/src/checks/directPayloadGoldens.json` (golden
hashes), `lib/docs/legacyDataPages.ts` (old page redirects) and the test
fixtures.

## What stays custom

- Parsers: real code per source.
- Aggregation maths that is not a sum or weighted mean, as a pure function in
  the declaration's `display.aggregation`.
- React components that are not a value card or choropleth: the election charts
  and result maps, the population pyramids and the house price series. The
  declaration names the component and the website looks it up by id.
