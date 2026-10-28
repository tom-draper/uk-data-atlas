# @uk-data-atlas/atlas-runtime

Node modules used by the API, data pipeline and website server to read and build atlas data. Import the domain entry point needed by a consumer:

- `@uk-data-atlas/atlas-runtime/areas` for area inventories, lookups and searches.
- `@uk-data-atlas/atlas-runtime/geometry` for geometry sources and storage.
- `@uk-data-atlas/atlas-runtime/places` for named locations and place search.
- `@uk-data-atlas/atlas-runtime/postcodes` for postcode indexes and counts.
- `@uk-data-atlas/atlas-runtime/relationships` for crosswalks and conversions.
- `@uk-data-atlas/atlas-runtime/catalogue` for measures, observations and evidence.
- `@uk-data-atlas/atlas-runtime/maps` for map resources and terrain.
- `@uk-data-atlas/atlas-runtime/storage` for atlas databases and release artifacts.
- `@uk-data-atlas/atlas-runtime/api` for route contracts and query handling.

These modules use Node APIs and are not intended for browser bundles. Browser-safe geography and catalogue code remains in the corresponding packages.
