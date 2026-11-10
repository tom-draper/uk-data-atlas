# @uk-data-atlas/areas

Looks up, resolves, searches and loads boundaries for areas.

Area inventory types and lookups. `createAreaLookup` builds a lookup from in-memory artifacts. `LazyAreaLookup` takes an inventory and a function that reads one available release, and caches records up to the supplied limit.
