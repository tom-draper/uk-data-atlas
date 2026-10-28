# @uk-data-atlas/areas

Area inventory types and lookups. `createAreaLookup` builds a lookup from in-memory artifacts. `LazyAreaLookup` takes an inventory and a function that reads one available release, and caches records up to the supplied limit. The package does not read SQLite or depend on the atlas runtime.
