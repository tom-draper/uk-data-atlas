# @uk-data-atlas/places

Named places, the gazetteer and place membership.

Place search, named-location models and dated membership lookups. `resolvePlaces` reads the `PlaceIndex` interface, so callers can provide an in-memory index or the SQLite reader in `@uk-data-atlas/places`. `NamedLocationResolver` provides named-location and area membership queries over an inventory and optional lookup. `LocationsResolver` reads crosswalk summaries through the `CrosswalkSummarySource` interface.

This package builds place indexes and named-location inventories, reads SQLite data, and compiles location projections.
