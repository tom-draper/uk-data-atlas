# @uk-data-atlas/search-index

Utilities for the sorted arrays used by compiled area, place and postcode indexes. Import from `@uk-data-atlas/search-index`.

Sort string keys with `compareCodeUnits` before searching them with `lowerBound` or `findSorted`. This keeps compiler and reader ordering independent of locale. `Indexed<T>` also supports tables that provide `at()` and optionally batch reads through `atEach()`.

`packPositions` writes positions as little-endian unsigned 32-bit integers. The package has no runtime dependencies and does not read files.
