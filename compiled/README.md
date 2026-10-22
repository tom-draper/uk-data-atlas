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
  └──▶ atlas.sqlite
         ├──▶ API server
         └──▶ Next.js server ──▶ hash-versioned JSON ──▶ browser
```

Neither product writes here. The data pipeline writes this release. Both servers
read catalogue datasets from `compiled/atlas.sqlite` on disk. The browser reads
JSON from the Next.js server and never opens SQLite or fetches from the API.

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

The `atlas-sqlite` stage depends on `terrain-catalogue` and `datasets` and writes this database
with the existing `node:sqlite` library. It replaces the whole database through
a temporary file and atomic rename. Every run writes every table, so the stage
cache detects its output without a retained-file `outputs` declaration.
Future tables must join this writer before their loaders migrate.

The database contains these tables:

| Table      | Column        | Type                   | Key and meaning                                                                  |
| ---------- | ------------- | ---------------------- | -------------------------------------------------------------------------------- |
| `meta`     | `key`         | `TEXT`                 | Primary key. Currently only `schemaVersion`.                                     |
| `meta`     | `value`       | `TEXT NOT NULL`        | Database schema version, currently `"1"`.                                        |
| `payloads` | `id`          | `TEXT NOT NULL`        | Primary key. `terrain-catalogue`, `dataset-manifest`, or `dataset:<output>`.     |
| `payloads` | `payload`     | `TEXT NOT NULL`        | Exact UTF-8 JSON text from its compiled input, preserving bytes and array order. |
| `datasets` | `type`        | `TEXT NOT NULL`        | Primary key. Catalogue dataset type.                                             |
| `datasets` | `output`      | `TEXT NOT NULL UNIQUE` | Compiled output name, without `.json`.                                           |
| `datasets` | `source`      | `TEXT NOT NULL`        | JSON source metadata from the manifest.                                          |
| `datasets` | `contract`    | `TEXT NOT NULL`        | JSON dataset contract.                                                           |
| `datasets` | `summary`     | `TEXT NOT NULL`        | JSON compilation summary.                                                        |
| `datasets` | `fingerprint` | `TEXT NOT NULL`        | Dataset compiler and input fingerprint.                                          |
| `datasets` | `sha256`      | `TEXT NOT NULL`        | SHA-256 of the exact uncompressed payload bytes.                                 |
| `datasets` | `bytes`       | `INTEGER NOT NULL`     | Uncompressed UTF-8 payload length.                                               |
| `datasets` | `payloadId`   | `TEXT NOT NULL`        | Foreign key to `payloads.id`, `dataset:<output>`.                                |

All tables use `WITHOUT ROWID`. Each dataset has one payload. The complete
manifest is also retained as a payload to preserve its version, input provenance
and ordering. Reusing `payloads` keeps ready-to-send JSON in one table alongside
the terrain catalogue. The writer validates every dataset's hash and length.
SQLite enforces the payload foreign key during the build.

The atomic writer rebuilds all tables, reading one dataset at a time. It avoids
retaining all payloads in memory. Incremental row updates would require copying
the database before mutation to retain atomic publication, so they are deferred.
The stage cache skips the whole write when inputs are unchanged.

`readTerrainCatalogue(apiRoot)` opens `../../compiled/atlas.sqlite` relative to
the API root in read-only mode, reads the `terrain-catalogue` row, validates its
schema version and products array, then closes the connection. It does not fall
back to JSON. Keep `compiled/atlas.sqlite` under the repository root when
deploying the API.
The `documents` stage depends on `atlas-sqlite` because it loads API catalogues.

`services/api/public/terrain-catalogue.json` remains a build intermediate for
release fingerprints and immutable release snapshots. The API terrain loader
no longer reads it. The API catalogue compiler, API atlas pages and website SEO compilers read
dataset payloads from SQLite.
Gazetteer core and boundary assets remain API build intermediates under
`services/api/public/source-data/`. Legacy provenance artifact labels in API
responses remain unchanged for byte compatibility.

The Next.js atlas pages pass a map of output names to hash-versioned URLs into
the client. `GET /data/catalogue/<sha256>/<output>.json` joins `datasets.payloadId`
to `payloads.id`, matching both output and hash before returning the exact JSON
with `Content-Type: application/json; charset=utf-8` and
`Cache-Control: public, max-age=31536000, immutable`. The route supplies gzip
compression when the client accepts it, with `Vary: Accept-Encoding`. Missing outputs and stale or invalid
hashes return 404 with `Cache-Control: no-store`, never a different payload at
an old URL. A database deployment can therefore invalidate uncached old URLs;
pages and the compiled release must deploy together.

Website precompile still reads `compiled/datasets/` to cut regional chunks. It
does not copy catalogue payloads into `public/data/datasets/`. That directory
still holds generated gazetteer, road-safety, regional chunk and SEO assets,
plus the website build manifest. `pnpm precompile:generate` and
`pnpm precompile:only` refresh SQLite after compiling datasets.

## Planned

This folder is becoming the release both products read from directly:
`atlas.sqlite` already holds catalogue datasets and the terrain catalogue. Areas, crosswalks,
and other ready-to-send payloads will follow, with
`tiles/*.pmtiles` for boundaries. As each part moves here, its product copies go
away and this README gains its tables.
