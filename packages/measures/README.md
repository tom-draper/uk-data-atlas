# @uk-data-atlas/measures

Measure and observation models, units, source compatibility, coverage and quality reports. `observationsFor` finds an observation artifact for a measure, source and period and provides both records and an area lookup. It accepts in-memory artifacts and the lazy table-backed artifacts supplied by `@uk-data-atlas/atlas-runtime/catalogue`.

The atlas runtime loads and caches SQLite artifacts and provides geographic conversion and reconciliation.
