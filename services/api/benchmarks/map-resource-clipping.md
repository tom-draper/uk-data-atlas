# Hierarchical ring clipping

The baseline is `32c559c9`, after polygon-part indexing. The benchmark and its
scope are described in [Map resource compilation](map-resource.md). This change
adds a binary tree over consecutive 32-vertex blocks in each projected ring.
Clipping classifies an entire subtree when all its vertices lie inside the tile
or beyond the same clipping edge. Only mixed leaf blocks require individual
vertex checks. Adjacent spans with the same classification become one run.
The clipper retains every inside vertex and the endpoints of outside runs,
including runs that wrap around the closing edge.

Tile-grid rounding, clipping edge order, intersection arithmetic, and final
encoding are unchanged. The hierarchy is built once per projected ring and reused
across tiles and zooms. Its bounds use more storage than the flat block array;
the shared per-vertex scratch arrays are removed.

Separate diagnostic compilations counted calls to `blockEdge`, the function
that classifies an extent against a tile. A counter at its entry recorded
43,472,739 classifications before and 2,975,920 after for the country release.
Both diagnostic runs produced the same artifact hash. Counter and profiler runs
are excluded from the timing results.

The remaining CPU profile has substantial time in zlib compression,
`simplifyGeometry`'s heap operations, coordinate placement, and topology
construction. Reusing simplification work across geometry tiers is a candidate
for a subsequent change. This PR only changes ring clipping.

## Reproduce

Use Node 26.10.0 and the production 4 GiB heap limit. Bundle the benchmark at the
baseline and current revision into separate files:

```sh
pnpm --dir services/api exec esbuild scripts/benchmark-map-resource.ts --bundle --platform=node --format=cjs --outfile=/tmp/map-baseline.cjs
```

Use `/tmp/map-hierarchy.cjs` for the changed revision. Both snapshots must read
the same repository's source data and generated registries. Alternate baseline
and changed compilations five times each, in fresh processes:

```sh
node --max-old-space-size=4096 /tmp/map-baseline.cjs /absolute/path/to/data-repository country/2025-12-uk-bgc
node --max-old-space-size=4096 /tmp/map-hierarchy.cjs /absolute/path/to/data-repository country/2025-12-uk-bgc
```

Repeat with `combinedAuthority/2025-12-en-bgc`. Check area and tile counts, output
bytes, and the aggregate artifact hash on every run. `/usr/bin/time -f '%M'`
records peak resident memory in KiB. Profiles and tests run separately from the
recorded timing batch.

## Results

Measured on 2026-10-16 on Linux with an Intel Core i5-1235U and 12 logical
CPUs. Inputs were local with a warm filesystem cache. A background native build
and code indexer also used the machine, so before and after runs were interleaved.
Exploratory runs are excluded. All 20 recorded compilations succeeded.

For `country/2025-12-uk-bgc`, median elapsed time fell from 9.040 s to 6.809 s,
a 24.7% reduction over five runs per revision. Baseline elapsed times ranged from
8.262 to 9.944 s; changed times ranged from 6.524 to 8.228 s. Process CPU medians
fell from 10.915 s to 8.632 s, a 20.9% reduction. CPU ranges were 10.172 to
11.792 s before and 8.408 to 10.410 s after. Peak resident memory ranged from
484,208 to 493,604 KiB before and 483,204 to 500,136 KiB after.

The smaller `combinedAuthority/2025-12-en-bgc` release showed no measurable
improvement. Median elapsed time was 0.902 s before and 0.941 s after, within
the overlapping ranges of 0.840 to 1.069 s and 0.881 to 1.021 s. CPU medians
were 1.281 s and 1.357 s, with ranges of 1.241 to 1.526 s and 1.298 to 1.492 s.
The hierarchy helps long rings that span many tiles; small rings have less work
to skip and still pay for tree traversal.

These results cover complete uncached compilation of each release, including
all geometry tiers and download formats. They do not measure the entire
`data:build` pipeline or incremental cache hits. Changing the compiler source
invalidates the map-resource build fingerprint, so the next build recompiles
cached releases.

## Output equivalence

All ten country runs produced 4 areas, 12,823 tiles, and 18,812,317 artifact
bytes. The aggregate descriptor and artifact SHA-256 was unchanged:

```text
9c6977d3ffc38f810a410690e0c41afac85619df21c8ce94e2ca80ecbb3cb1de
```

All ten combined-authority runs produced 15 areas, 2,578 tiles, and 3,340,006
artifact bytes, with aggregate SHA-256:

```text
5e580167f1625440cbfcca293f625223d3bef2c3b45544c8886571f65a5f2a5d
```

## Raw timings

Values are milliseconds in execution order within each revision. Each baseline
run was immediately followed by the corresponding changed run.

`country/2025-12-uk-bgc`:

```text
baseline elapsedMs: 9633.772, 8525.015, 9943.922, 9039.711, 8262.007
baseline cpuMs: 11791.970, 10314.284, 11592.342, 10915.488, 10172.350
baseline maxRssKiB: 493424, 485440, 493604, 484208, 493400
hierarchy elapsedMs: 8228.284, 6841.325, 6808.672, 6524.160, 6612.270
hierarchy cpuMs: 10409.851, 8631.824, 8634.110, 8407.688, 8438.260
hierarchy maxRssKiB: 485472, 483204, 488120, 500136, 496424
```

`combinedAuthority/2025-12-en-bgc`:

```text
baseline elapsedMs: 850.773, 902.028, 976.233, 1068.719, 839.761
baseline cpuMs: 1240.816, 1280.552, 1417.254, 1526.299, 1244.384
baseline maxRssKiB: 212424, 210120, 210556, 217056, 212208
hierarchy elapsedMs: 881.236, 912.525, 941.171, 1012.038, 1021.037
hierarchy cpuMs: 1297.584, 1316.102, 1357.420, 1491.527, 1447.605
hierarchy maxRssKiB: 218808, 221328, 210976, 215516, 208700
```
