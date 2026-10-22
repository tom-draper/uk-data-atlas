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

Neither product writes here. Each copies what it needs into its own folder.

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

## Planned

This folder is becoming the release both products read from directly:
`atlas.sqlite` for areas, crosswalks, datasets and ready-to-send payloads, and
`tiles/*.pmtiles` for boundaries. As each part moves here, the copies above go
away and this README gains its tables.
