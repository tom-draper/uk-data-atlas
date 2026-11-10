# @uk-data-atlas/measures

Measure definitions, quality, reconciliation and unit conversion.

Measure and observation models, units, source compatibility, coverage, quality reports, geographic conversion and reconciliation. `observationsFor` finds an observation artifact for a measure, source and period and provides both records and an area lookup. It accepts in-memory artifacts and the lazy table-backed artifacts supplied by `@uk-data-atlas/catalogue/node`.

The domain packages load SQLite artifacts through `atlas-db`, and `atlas-loader` provides the geography resolver.
