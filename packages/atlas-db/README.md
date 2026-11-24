# @uk-data-atlas/atlas-db

Opens atlas.sqlite and resolves data file locations.

## Search indexes

`@uk-data-atlas/atlas-db/search` holds utilities for the sorted arrays used by compiled area, place and postcode indexes. It is browser safe and reads no files.

Sort string keys with `compareCodeUnits` before searching them with `lowerBound` or `findSorted`. This keeps compiler and reader ordering independent of locale. `Indexed<T>` also supports tables that provide `at()` and optionally batch reads through `atEach()`.

`packPositions` writes positions as little-endian unsigned 32-bit integers. The Node-only entry point `@uk-data-atlas/atlas-db/search/node` exports `NAME_NORMALISATION`, a fingerprint of the geography package's place-name matching rules used to check index compatibility.
