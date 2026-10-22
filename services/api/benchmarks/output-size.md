# API output size: findings

Measured on 2026-10-21 against the existing build in the main checkout
(`services/api/public/`, built 2026-10-19 from `dc74ffdb`), one worker,
warm page cache unless stated. That build is 7.5 GB, not the 9.7 GB in the
brief, so the numbers below are for this build.

## Where the bytes are

| Directory                               |     Size | Read by the server                                              |       Compresses (gzip) |
| --------------------------------------- | -------: | --------------------------------------------------------------- | ----------------------: |
| `map-resources/` Parquet, 4 tiers       | 2,156 MB | streamed from disk                                              |      already gzip pages |
| `map-resources/` GeoJSON `.gz`, 4 tiers | 1,102 MB | streamed from disk                                              |            already gzip |
| `map-resources/` PMTiles                |   868 MB | tile by tile                                                    |                     n/a |
| `geometry-store/*.bin`                  | 1,400 MB | per area, by byte range                                         |           2.6x (zstd-3) |
| `postcode-areas/`                       |   633 MB | one district shard per request                                  |                      5x |
| `exports/` CSV                          |   537 MB | streamed raw, never compressed                                  |                     20x |
| `crosswalks/`                           |   375 MB | whole file parsed, LRU 64 MB                                    | 12x (35% is whitespace) |
| `location-projections/`                 |   254 MB | whole shard parsed, LRU 8 shards                                |    12x (34% whitespace) |
| `documents/`                            |   105 MB | served at `/v1/documents/*`                                     |                     11x |
| `place-index.json`                      |    53 MB | whole file parsed on first search                               |                         |
| `named-locations.json`                  |    84 MB | not at runtime (shared SQLite is used); hashed into the release |                         |

Per tier, Parquet vs gzipped GeoJSON: full 983 / 489 MB, high 768 / 391,
medium 323 / 175, low 80 / 45. The Parquet is the larger copy, because it
stores full-precision float64 WKB, which compresses poorly. GeoJSON rounds to
6 decimal places.

## Leads

1. **GeoJSON vs Parquet.** The contract publishes both formats at every tier,
   with `bytes` and `contentHash` for each in `map-resources.json`, and serves
   them with Range support. Building GeoJSON on request is possible but costly
   for large releases: gzip of the 123 MB output-area GeoJSON alone takes 2.2 s.
   It would also need a writable cache, and `compose.yaml` mounts `public/`
   read-only.
2. **Exports.** CSVs are streamed uncompressed even to gzip clients (the 22 MB
   house-price CSV goes out as 22 MB). The server already serves "stored
   gzipped" files (`StoredFile.gzipBytes`, used by map GeoJSON), decoding for
   clients that do not accept gzip. Storing CSVs gzipped saves about 510 MB
   and cuts those transfers about 20x. Visible change: the manifest's
   `artifact` becomes `exports/<id>.csv.gz` and gains `gzipBytes`, as map
   features already do.
3. **Geometry store vs `-full.parquet`.** Same geometry: identical vertex
   counts and coordinates (checked on 4 local authority releases; GeoJSON
   differs only by rounding). The full tier is held three times: store
   1,400 MB, Parquet 983 MB, GeoJSON 489 MB. The store cannot go (the server
   needs per-area random access and its spatial index). The full-tier
   downloads could be produced from it, with the same costs as lead 1.
4. **Lookups in memory.** Postcodes, postcode areas, crosswalks and location
   projections are already sharded and loaded lazily. The costs are first-hit
   parses:

    | First request                             |         Time |                   RSS added |
    | ----------------------------------------- | -----------: | --------------------------: |
    | Place search (`place-index.json`, 53 MB)  | 0.5 to 1.3 s |          about 300 MB, kept |
    | Largest crosswalk (38 MB)                 | 0.4 to 1.1 s |                about 145 MB |
    | Largest location projection shard (19 MB) | 0.6 to 1.9 s | about 95 MB, up to 8 cached |

    Per worker, so doubled with the default 2 workers.

Startup: 0.64 s and 308 MB RSS warm; 13.7 s cold, nearly all of it reading
the geometry store's tables from disk. Warm responses for small routes are
1 to 2 ms; large downloads stream from disk at disk speed.

## Recommended changes

Small, no contract change beyond a manifest path:

- **A. Gzip export CSVs on disk.** About -510 MB, faster CSV downloads.
- **B. Store internal JSON lookups minified and gzipped** (crosswalks,
  location projections, postcode areas, postcodes). About -1.1 GB.
  Adds a gunzip on first load (tens of ms); memory unchanged.

Larger, to agree first:

- **C. Place index in `node:sqlite`.** Removes the 300 MB per worker held
  after the first search and the 0.5 to 1.3 s first-search stall.
- **D. Compress geometry store records** (zstd per area, Node built-in).
  About -0.8 GB and less cold-start I/O. Adds a small decompress per area.
- **E. Map-resource downloads.** Pick one:
    - E1: generate full-tier downloads from the geometry store on first
      request into a writable cache volume. About -1.47 GB; first download of
      a big release takes seconds; needs a new volume in `compose.yaml`.
    - E2: drop one tier as a documented contract change. `high` costs 1.16 GB
      and is 78% of `full`'s size.
    - E3: leave as is.

## Results

Measured the same way, one worker, warm cache.

| Change                                       | Disk before | Disk after |
| -------------------------------------------- | ----------: | ---------: |
| A. Export CSVs gzipped (`exports/`)          |      531 MB |      38 MB |
| B. Crosswalks                                |      375 MB |      24 MB |
| B. Location projections (with parent shards) |      258 MB |      16 MB |
| B. Postcode areas                            |      633 MB |     108 MB |
| B. Postcode shards                           |       99 MB |      23 MB |

The 22 MB house-price CSV export: a client accepting gzip now receives
1.15 MB in 10 ms instead of 22 MB in 44 ms. A client that does not accept
gzip gets it decoded on the fly, 0.58 s instead of 0.06 s locally. CSV
exports are no longer served in byte ranges.

Reading and parsing the largest crosswalk (38 MB of JSON) takes 292 ms from
the gzipped file against 381 ms from the plain one: less to read from disk
outweighs the decompression. Memory once parsed is unchanged.
