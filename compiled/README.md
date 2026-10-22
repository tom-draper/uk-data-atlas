# compiled/

Data compiled once from the raw sources in `data/`, for both the website and the
API. Everything here is generated, and only this README is tracked. Rebuild it
with `pnpm data:build` (see "One data build" in `ARCHITECTURE.md`).

```text
data/                 raw sources, restored from the pinned data release
  │
  ▼  pnpm datasets:compile
compiled/
  datasets/
    dataset-manifest.json     one entry per catalogue dataset
    <output>.json             one compiled payload per entry
  │
  ├──▶ public/data/datasets/            website (copied by pnpm precompile)
  └──▶ services/api/public/datasets/    API (copied by build:datasets)
```

Neither product writes here. Datasets are still copied into each product.
The API reads the terrain catalogue directly from `compiled/atlas.sqlite`.

## datasets/

`dataset-manifest.json` is `{ "version": 1, "datasets": [...] }`, with one entry
per dataset in `CATALOGUE_DATASET_DEFINITIONS`, in catalogue order.

| Field         | Meaning                                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| `type`        | The dataset's id in the catalogue, e.g. `claimantCount`.                                                             |
| `output`      | Its payload file, `<output>.json` beside the manifest.                                                               |
| `source`      | Where the data comes from and its licence, from the definition.                                                      |
| `contract`    | The ingestion contract the source was checked against.                                                               |
| `inputs[]`    | Each raw file read: `kind`, `path` under `data/`, `bytes`, `sha256`, and the file's size and mtime when it was read. |
| `summary`     | `datasetCount`, `dataRecordCount` and `boundaryYears`, from validation.                                              |
| `compiled`    | The payload's `bytes` and `sha256`, and its mtime when written.                                                      |
| `fingerprint` | A hash of the code that compiled it.                                                                                 |

A payload is the dataset's compiled records, keyed by dataset id, with dense
number maps stored as arrays (`@uk-data-atlas/catalogue/compactPayload`).

A later run reuses a payload when its `fingerprint` is unchanged, every input
still has the recorded size and mtime (or belongs to the pinned data release),
and the payload still matches `compiled`. Otherwise the dataset is compiled
again. `pnpm datasets:compile --only <type>` recompiles just the named
datasets.

## atlas.sqlite

The `atlas-sqlite` stage depends on `terrain-catalogue` and writes this database
with the existing `node:sqlite` library. It replaces the whole database through
a temporary file and atomic rename. Every run writes every table, so the stage
cache detects its output without a retained-file `outputs` declaration.
Future tables must join this writer before their loaders migrate.

The database currently contains two tables:

| Table      | Column    | Type            | Key and meaning                                                                                                                    |
| ---------- | --------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `meta`     | `key`     | `TEXT`          | Primary key. Currently only `schemaVersion`.                                                                                       |
| `meta`     | `value`   | `TEXT NOT NULL` | Database schema version, currently `"1"`.                                                                                          |
| `payloads` | `id`      | `TEXT NOT NULL` | Primary key. Currently only `terrain-catalogue`.                                                                                   |
| `payloads` | `payload` | `TEXT NOT NULL` | Complete JSON manifest, including its own `schemaVersion`, `contentHash`, `publicationRequirements`, and ordered `products` array. |

Both tables use `WITHOUT ROWID`. There are no foreign keys or relationships
between tables yet. Product ids and `dependsOn` references remain inside the
terrain payload, with their existing JSON structure and order.

`readTerrainCatalogue(apiRoot)` opens `../../compiled/atlas.sqlite` relative to
the API root in read-only mode, reads the `terrain-catalogue` row, validates its
schema version and products array, then closes the connection. It does not fall
back to JSON. Keep `compiled/atlas.sqlite` under the repository root when
deploying the API.
The `documents` stage depends on `atlas-sqlite` because it loads API catalogues.

`services/api/public/terrain-catalogue.json` remains a build intermediate for
release fingerprints and immutable release snapshots. The API terrain loader
no longer reads it. Other API loaders still read their existing files.

## Planned

This folder is becoming the release both products read from directly:
`atlas.sqlite` already holds the terrain catalogue payload. Areas, crosswalks,
datasets, and other ready-to-send payloads will follow, with
`tiles/*.pmtiles` for boundaries. As each part moves here, its product copies go
away and this README gains its tables.
