# Map resource compilation

`benchmark-map-resource.ts` compiles a real release through `compileMapResource`,
including source loading, reprojection, topology, all four geometry tiers, vector
tiles, PMTiles, GeoParquet, and gzipped GeoJSON. It bypasses the incremental map
build cache and leaves published artifacts untouched. Registry and name loading,
output hashing, and disk writes are outside the timer. Process CPU time sums
user and system CPU time across the process's threads.

Run from the repository root after building the API's source registries and area
inventory:

```sh
pnpm exec tsx --max-old-space-size=4096 pipeline/src/benchmark-map-resource.ts . country/2025-12-uk-bgc
```

The first argument is the data repository root, and the second is the release ID.
The JSON result includes elapsed and process CPU milliseconds, area and tile
counts, output bytes, and a SHA-256 over the descriptor and every generated artifact. Compare the hash
across revisions, as well as timings. A failed compilation exits unsuccessfully.

## Method

The baseline is `bef9c1fd`. Copy the benchmark script into that checkout before
bundling. Build a standalone snapshot in each checkout, using separate output
paths for before and after:

```sh
pnpm exec esbuild pipeline/src/benchmark-map-resource.ts --bundle --platform=node --format=esm --banner:js='import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' --outfile=/tmp/map-benchmark.mjs
node --max-old-space-size=4096 /tmp/map-benchmark.mjs /absolute/path/to/data-repository country/2025-12-uk-bgc
```

The recorded runs use Node 26.10.0 on Linux with 12 logical CPUs and the production
4 GiB heap limit. Each run starts a fresh process against the same local inputs.
The filesystem cache is warm. Run before and after alternately five times each,
without profilers or tests running alongside them. A background native build also used the machine during this session. Both CPU
and elapsed time are recorded to distinguish computation from scheduler delay.
Compare ranges as well as medians.

Separate CPU profiles identify tile clipping as the main cost. A ring-visit
counter records 74,173,323 visits before and 351,981 after for the country release. Each
visit checks a ring against a tile even when it is a distant island.
The change indexes polygon parts by tile at each zoom, including neighbouring
tiles for the buffer and rounding. Candidate lists retain source polygon order,
and the original clipper still decides which rings survive. Single polygons use
the existing direct path. Only the current zoom's index is held per feature.
Clipping the remaining candidates and compressing the artifacts still cost time.

This measures a complete compilation of one release, not the entire `data:build`
pipeline or a cached map build. The source change invalidates the existing map
compiler fingerprint, so the first incremental build after upgrading recompiles
map resources.

## Recorded results

On 2026-10-16, five alternating runs per revision of
`country/2025-12-uk-bgc` reduced median elapsed compilation time from 17.433 s to
10.379 s, a 40.5% reduction. The elapsed ranges were 15.987 to 18.116 s before
and 9.676 to 10.901 s after. Process CPU medians fell from 19.422 s to 12.281 s;
CPU ranges were 17.945 to 20.070 s before and 11.565 to 12.892 s after.

All ten compilations succeeded with 4 areas, 12,823 tiles, and 18,812,317 output
bytes. Every descriptor, PMTiles archive, GeoParquet file, and gzipped GeoJSON
file contributed to the identical aggregate SHA-256:

```text
9c6977d3ffc38f810a410690e0c41afac85619df21c8ce94e2ca80ecbb3cb1de
```

The runs in milliseconds, in execution order within each revision:

```text
baseline elapsedMs: 17433.425, 17910.955, 16235.560, 18116.053, 15986.920
baseline cpuMs: 19422.470, 19963.901, 18143.220, 20070.228, 17944.823
indexed elapsedMs: 10901.377, 10378.985, 10525.224, 9676.375, 9718.349
indexed cpuMs: 12892.305, 12280.730, 12489.452, 11565.091, 11573.709
```

An additional output-equivalence check on `combinedAuthority/2025-12-en-bgc`
matched all artifacts for 15 areas and 2,578 tiles, totaling 3,340,006 bytes.
Its aggregate SHA-256 was
`5e580167f1625440cbfcca293f625223d3bef2c3b45544c8886571f65a5f2a5d`.
