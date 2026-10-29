# @uk-data-atlas/atlas-runtime

Node modules used by the API, data pipeline and website server to read and build atlas data. Import the domain entry point needed by a consumer:

- `@uk-data-atlas/atlas-runtime/areas` for area inventories, lookups and searches.
- `@uk-data-atlas/atlas-runtime/geometry` for geometry sources and storage.
- `@uk-data-atlas/atlas-runtime/places` for place index compilation, SQLite readers and location projections.
- `@uk-data-atlas/atlas-runtime/postcodes` for postcode release selection and publishing.
- `@uk-data-atlas/atlas-runtime/relationships` for crosswalks and conversions.
- `@uk-data-atlas/atlas-runtime/catalogue` for catalogue loading, observation storage and evidence.
- `@uk-data-atlas/atlas-runtime/maps` for map resources.
- `@uk-data-atlas/atlas-runtime/storage` for atlas databases and release artifacts.
- `@uk-data-atlas/atlas-runtime/api` for route contracts and query handling.

These modules use Node APIs and are not intended for browser bundles. Browser-safe geography and catalogue code remains in the corresponding packages.

Terrain catalogue types and providers live in `@uk-data-atlas/terrain`.

Postcode indexes, area placements and counts live in `@uk-data-atlas/postcodes`.

Area inventory types and data-source-independent lookups live in `@uk-data-atlas/areas`. The runtime supplies the SQLite reader.

Crosswalk models, translation and member reconciliation live in `@uk-data-atlas/relationships`. The runtime provides the atlas storage readers and higher-level composition.

Spatial queries and shared-border calculations live in `@uk-data-atlas/geometry`. The runtime supplies the source and compiled-file readers and caches.

Place search and named-location membership live in `@uk-data-atlas/places`.

Measure definitions, observation access, units, compatibility, coverage, geographic conversion and reconciliation live in `@uk-data-atlas/measures`.

The geography resolver composes focused area, spatial, lineage, location and postcode resolvers. `PostcodeResolver` can read its indexes without constructing the geography resolver; area placement additionally takes a spatial resolver.
