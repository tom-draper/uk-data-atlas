# @uk-data-atlas/shapefile

Read polygon Shapefiles and dBase records in Node.js via `@uk-data-atlas/shapefile`.

`readShapefileFeatures(path)` reads the `.shp` and its matching `.dbf`, returning polygon features with their record properties. Deleted dBase rows and null shapes are skipped without shifting the remaining records. The reader accepts Polygon, PolygonZ and PolygonM shapes; it reads their two-dimensional coordinates.

`readDbfRecords(path)` reads the non-deleted records of a dBase file when geometry is not needed. Both functions read files synchronously and throw for file errors or invalid input that they detect.
