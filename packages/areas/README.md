# @uk-data-atlas/areas

Looks up, resolves, searches and loads boundaries for areas.

Area inventory types and lookups. `AreaReleaseSource` is the narrow view of release selection that `countryRelease` and the measures package read, and `SpatialResolver` answers containing, nearby and intersecting area queries. `atlas-loader` passes in its concrete resolver. `createAreaLookup` builds a lookup from in-memory artifacts. `LazyAreaLookup` takes an inventory and a function that reads one available release, and caches records up to the supplied limit.
