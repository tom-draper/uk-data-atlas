# @uk-data-atlas/geometry

Stores, loads and queries area geometry.

Spatial queries over a supplied geometry release. `SpatialQueries` accepts candidate, bounds and geometry readers, and supports containment, nearest-area, box intersection and neighbour searches. The package also provides shared-border calculations, and the full-detail download source over a `FullDetailReleaseSource` (boundary release metadata and release areas).

## Shapefiles

Read polygon Shapefiles and dBase records in Node.js via `@uk-data-atlas/geometry/shapefile`.

`readShapefileFeatures(path)` reads the `.shp` and its matching `.dbf`, returning polygon features with their record properties. Deleted dBase rows and null shapes are skipped without shifting the remaining records. The reader accepts Polygon, PolygonZ and PolygonM shapes; it reads their two-dimensional coordinates.

`readDbfRecords(path)` reads the non-deleted records of a dBase file when geometry is not needed. Both functions read files synchronously and throw for file errors or invalid input that they detect.
