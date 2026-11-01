# Boundary download storage

Measured on 1 November 2026 against main at `ad5033cc`, using the existing
`data/build/map-resources` as the baseline. This checkout already generated full
detail on request, so its baseline is smaller than the older 5.2 GB in issue #406.

## Disk use

`du -s -B1` measures allocated bytes, including build state and directory entries.

| Directory     |        Before |         After |
| ------------- | ------------: | ------------: |
| Map resources | 2,635,972,608 | 1,018,576,896 |

The saving is **1,617,395,712 bytes, 61.4%**, about 1.51 GiB. The new directory
contains 99 PMTiles archives and one build-state file. Full detail still comes
from the geometry store, which remains deployed and is excluded from this
comparison because this change does not remove it.

The removed variants had the following allocated sizes. Each row contained 99
files. Directory and build-state size changes account for the remaining saving.

| Variant           | Allocated bytes |
| ----------------- | --------------: |
| Low GeoJSON.gz    |      57,110,528 |
| Medium GeoJSON.gz |     203,395,072 |
| Low GeoParquet    |      98,537,472 |
| Medium GeoParquet |     362,156,032 |
| High GeoParquet   |     896,135,168 |
| PMTiles, retained |   1,018,064,896 |

## Byte comparisons

The full sequential rebuild completed with a 2,816 MiB Node heap cap. All 104
release outcomes match the baseline: 99 tiled releases and five releases with
overlapping boundaries that retain only full-detail downloads. All 99 generated
PMTiles files match both the baseline SHA-256 and the published content hash.
All 594 download descriptors on tiled releases match after removing the optional
`artifact` field. This includes hashes, decoded sizes and gzip sizes. The five
untiled records also match, excluding their compiler cache keys.

`pipeline/src/verify-map-downloads.ts` compares request-time generation from the
deployed geometry store with the old prebuilt files. It asserts decoded bytes,
published SHA-256 and byte counts, and identical gzip bytes for GeoJSON. It must
compare all five simplified variants per release or exit nonzero.

The checked releases cover combined authorities, local authorities, wards,
LSOAs and output areas. Per-variant hashes, byte counts and elapsed seconds are
in [download-storage-comparisons.json](download-storage-comparisons.json).
Each release runs in a separate process. Every variant is generated without a
download-cache hit, but later variants can reuse the release's loaded geometry.
These timings do not represent fully cold HTTP latency.

To reproduce against an unchanged baseline checkout, run each release
sequentially from this checkout. A nonzero exit or fewer than five JSON result
lines per release means the comparison failed.

```sh
pnpm exec tsx --max-old-space-size=2048 pipeline/src/verify-map-downloads.ts /path/to/baseline combinedAuthority/2025-12-en-bgc
pnpm exec tsx --max-old-space-size=2048 pipeline/src/verify-map-downloads.ts /path/to/baseline localAuthority/2024-12-uk-bgc
pnpm exec tsx --max-old-space-size=2048 pipeline/src/verify-map-downloads.ts /path/to/baseline ward/2024-12-uk-bgc
pnpm exec tsx --max-old-space-size=2048 pipeline/src/verify-map-downloads.ts /path/to/baseline lsoa/2001-12-ew-bgc-v2
pnpm exec tsx --max-old-space-size=2048 pipeline/src/verify-map-downloads.ts /path/to/baseline outputArea/2021-12-ew-bgc-v2
```

The first rebuild attempt exhausted a 2,560 MiB heap on the untiled 2001 output
areas. Releasing the vertex index before allocating the edge index, and releasing
the edge index after ownership counting, removed overlapping index lifetimes.
The complete rebuild then passed at 2,816 MiB. Build stages ran sequentially.

## Serving and checks

Public download URLs, tiers and decoded payloads remain unchanged. Simplified
downloads use the existing 64 MiB LRU, published-hash validation and a serialized
generation queue. Concurrent requests for the same download share one build.
Oversized downloads are served without retention. Generated GeoJSON supports
gzip and conditional responses; GeoParquet retains byte ranges. The CDN serves
PMTiles, while generated downloads keep API URLs. The website catalogue remains
independent and its links do not change.

Cold simplified generation is synchronous CPU work and can delay other requests.
The cache trades repeated computation for bounded memory. Deployment must retain
the geometry store. See [DEPLOYMENT.md](../DEPLOYMENT.md).

Validation completed:

- Root unit suite: 211 files, 1,243 tests passed.
- API unbuilt suite: 1,025 passed, one skipped. The subsequent cleanup/resume
  regression and download tests passed, four tests total.
- MCP suite: 39 tests passed.
- API typecheck, runtime build and client regeneration passed.
- The full map-resource rebuild, stored-file comparisons and cleanup/resume test
  ran locally. No raw-data-dependent test was added to CI.
- Root `pnpm check` passed its typechecks but stopped at formatting warnings in
  16 files unchanged from main. Those unrelated route and pipeline files were
  left untouched. Changed-file formatting and `git diff --check` passed.
