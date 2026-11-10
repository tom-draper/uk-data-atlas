# Generated API data

`data/build/atlas.sqlite` contains the catalogue, geography and statistics
rows used by the API. `data/build/atlas-cache.sqlite` holds derived search,
postcode, projection and dataset payload caches. Dataset payloads are stored
gzipped and the API decompresses them when it needs the JSON. Deploy both
databases from the same build; the API checks the cache stamp and the payload
columns at startup.

The `data-catalog` stage writes the catalogue. The
`statistics-read-path` stage derives a selector for every catalogue artifact
from the statistics registry and declared selection rules. Selectors include
the catalogue hash, which readers validate before serving data.

The API reconstructs observation artifacts from statistics rows. Compatibility,
analysis geography validation, the validation report and exports use the same
read path. Reconstructed JSON and parsed views share a bounded LRU cache.
Observation JSON is derived from the rows; fixture tests cover the selectors.

The generated `statistics-vocabulary.json` and `statistics-read-path.json`
are build intermediates. Runtime readers use the vocabulary and selectors in
`atlas.sqlite`. The committed vocabulary in
`services/api/config/statistics-vocabulary.json` supports unbuilt checks. After
reviewing a vocabulary change, copy the generated vocabulary there and commit it.

The API reads catalogue manifests, export metadata, geometry metadata and
evidence documents from `data/build/artifacts/`. Atlas page and lookup assets
live under `data/build/atlas-assets/` and in the `website_asset` table of
`data/build/website-assets.sqlite`, which only the website reads. See `data/build/README.md` for the database schema and build outputs.
