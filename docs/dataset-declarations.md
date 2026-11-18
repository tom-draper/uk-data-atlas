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
| `guide`, `mapName`                                              | The words the docs and `/datasets` pages use (title, about, summary) and the name of the dataset's map as people search for it.      |
| `source`, `sources`                                             | Name, publisher, URLs, licence, attribution, description, edition year, cadence, notes; and the `data/source` folders it reads.      |
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
  (the manifest definitions and the dataset record types), plus two modules the
  registry entry point reads without loading any reader:
  `declaration/declaredGuides.ts` (from `guide`, `topic` and `related`) and
  `declaration/declaredSources.ts` (from `sources`, which names the source
  folders and which datasets each feeds). All are generated and checked in, and
  `pipeline/tests/catalog/declaredRegistries.test.ts` fails when one is stale.
- `definitionOf` turns a declaration into the manifest definition the dataset
  compiler reads. `statisticsOf` turns it into the statistics declaration the
  rows are written and read back from (`packages/measures/src/statisticsDatasets`).
- `catalogue` is read by `pipeline/src/catalog/declaredIndicators.ts`, which
  publishes the API measures and their observation artifacts.
- `display`, `mapViews`, `categories`, `ranking` and `placeHeadline` are read by
  `lib/datasets/declared.ts`, `lib/datasets/categories.ts` and
  `lib/places/headlines.ts`, and `mapName` by `lib/atlas/pages.ts`, so a dataset that fits the shared card and map
  needs no website code.

## Validation

`defineDataset` runs `declarationProblems`
(`packages/datasets/src/declaration/validate.ts`) when the module is first
imported, so an invalid declaration fails typecheck, tests and every build
stage rather than reaching a table or a page. It rejects:

- an empty source term or guide title, a URL that is not http(s), or an unknown cadence;
- an empty list of source folders, or a folder with an empty name;
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
  replaced to authorities;
- per indicator, `status: "derived"` for values the atlas computed from finer
  published ones, and a weighted-mean `aggregation` with `available: true` where
  the API serves the mean because it also serves the weight.

The dataset's `source.notes` are published with every indicator.

## Adding a simple dataset today

1. Write `<theme>/<topic>/<id>/dataset.ts` and its source parser. A dataset of
   one value per authority can use `IndicatorDataset<"<id>">` as its payload
   type (see `waste`) and needs no type file.
2. Put its files in `data/source/<theme>/<topic>/<id>/` with a `meta.json`.
3. Run `pnpm data:build --only catalogue-registry`, the website registry
   generator (`scripts/generate-dataset-registry.ts`) and `pnpm ids`.

Nothing else is written by hand: the guide, source folders, API measures, map
name, manifest entry, record types and website card all come from the
declaration. Trying it with a copy of the waste declaration under a new id, the
catalogue registry generator wrote it into the guides, source folders and
record types, and the only failing tests were about its data folder, a
duplicate source name and a topic allowlist. The website registry generator
needs the built `public/data`, so that step was not tried.

## What still lives outside the declaration

These places still name datasets. Each is a follow-up to #708.

| Place                                                                                                                                                               | Holds                                                             | Why it is still there                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pipeline/src/catalog/{crime,roadCollisions,jobs,emissions,unemployment}.ts`                                                                                        | API measures written as compilers                                 | They read the period, notes or partitions from the data, or check counts against the manifest (crime, road collisions, jobs, emissions). Each needs an extension of `catalogue`, not just moving. |
| `pipeline/src/catalog/{regionalGdp,energyConsumption,population,populationDensity,housePrice,lifeExpectancy,deprivation,nimdm,elections,census,censusSmallArea}.ts` | API measures written as compilers                                 | Not migrated and not read closely enough here to say which fit `catalogue`. Each has fixtures in `pipeline/tests/built/dataCatalog.test.ts`, which is how to prove a move.                        |
| `pipeline/src/statistics/bindCompiledFields.ts`                                                                                                                     | Indicator id to dataset field, for those compilers                | Goes entry by entry as each compiler moves.                                                                                                                                                       |
| `lib/atlas/rankingRecipes.ts`, `lib/atlas/figures.ts`, `scripts/map-figures.ts`                                                                                     | Ranking columns and place figures, mostly functions               | Code rather than description, and the website work of #709.                                                                                                                                       |
| `declaration/sources.ts`, `declaration/sourceDatasets.ts`, `declaration/guides.ts`                                                                                  | The census small-area tables and the foundation (`core/`) sources | They have no declaration. Declaring the census tables would remove the last hand-written guides and source rows.                                                                                  |
| `types/<name>.ts`, `types/index.ts`, `packages/datasets/src/index.ts`                                                                                               | Payload types and re-exports                                      | Payload types belong with the parser. The re-exports are convenience, and a new dataset does not need one.                                                                                        |

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
