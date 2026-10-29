# @uk-data-atlas/measures

Measure and observation models, units, source compatibility, coverage, quality reports, geographic conversion and reconciliation. `observationsFor` finds an observation artifact for a measure, source and period and provides both records and an area lookup. It accepts in-memory artifacts and the lazy table-backed artifacts supplied by `@uk-data-atlas/atlas-runtime/catalogue`.

The atlas runtime loads and caches SQLite artifacts and provides a geography resolver that satisfies the reconciliation interface.
