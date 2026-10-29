# @uk-data-atlas/places

Place search, named-location models and dated membership lookups. `resolvePlaces` reads the `PlaceIndex` interface, so callers can provide an in-memory index or the SQLite reader in `@uk-data-atlas/atlas-runtime/places`. `NamedLocationResolver` provides named-location and area membership queries over an inventory and optional lookup.

The runtime package builds place indexes and named-location inventories, reads SQLite data, and compiles location projections.
