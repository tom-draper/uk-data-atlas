# Generated API data

`data/build/atlas.sqlite` contains the catalogue, geography and statistics
rows used by the API. `data/build/atlas-cache.sqlite` holds derived search,
postcode, projection and dataset payload caches. Dataset payloads are stored
gzipped and the API decompresses them when it needs the JSON. Deploy both
databases from the same build; the API checks the cache stamp and the payload
columns at startup.

The `data-catalog` stage writes the catalogue and independently compiled
observation artifacts to `data/build/compiled-observations/`. The
`statistics-read-path` stage compares these artifacts by value with the
statistics rows in `atlas-base.sqlite`. It writes a selector for every
catalogue artifact and fails when a comparison does not pass. The selectors
include the catalogue hash, which readers validate before serving data.

The API reconstructs observation artifacts from statistics rows. Compatibility,
analysis geography validation, the validation report and exports use the same
read path. Reconstructed JSON and parsed views share a bounded LRU cache.
Compiled observation artifacts are build inputs and are not a runtime fallback.

The generated `statistics-vocabulary.json` and `statistics-read-path.json`
must accompany `atlas.sqlite`. The committed vocabulary in
`services/api/config/statistics-vocabulary.json` supports unbuilt checks. After
reviewing a vocabulary change, copy the generated vocabulary there and commit it.

The API reads catalogue manifests, export metadata, geometry metadata and
evidence documents from `data/build/artifacts/`. Atlas page and lookup assets
live under `data/build/atlas-assets/` and in the database's `website_assets`
table. See `data/build/README.md` for the database schema and build outputs.
