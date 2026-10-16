# Shared simplification across geometry tiers

The baseline compiler snapshot is `df70c87e`, after hierarchical ring clipping.
The branch is refreshed onto `af76a12d`; the intervening changes do not alter the
map compiler or simplifier. The benchmark scope is described in
[Map resource compilation](map-resource.md).

Previously, each non-full geometry tier projected every arc and rebuilt its
vertex-removal heap. Refining a collapsed ring repeated that work again.
`compileTiers` now records one removal sequence per arc, up to the coarsest
configured threshold. Every tier and refinement selects vertices from it.

A vertex's importance is the largest triangle area encountered before its
removal, including its own area. New triangles can have smaller areas than
previously removed ones, so using their raw areas would change finer tiers.
Unremoved vertices retain Infinity. Strict threshold comparisons, heap tie
ordering, open-arc endpoints, and the closed-ring triangle minimum are preserved.
The weights are local to tier compilation and become eligible for collection
when it returns. The single-ring simplifier uses the same algorithm.

A separate country diagnostic counted heap construction: 12,127 heaps over
1,001,502 input vertices before, versus 4,026 heaps over 333,496 vertices after.
Both diagnostic runs produced the same artifact hash. These counters confirm
that repeated projection and heap work was removed; their runs are excluded
from the timings below.

## Reproduce

Use Node 26.10.0 with the production 4 GiB heap limit. Build snapshots at the
baseline and changed revision with separate output filenames:

```sh
pnpm --dir services/api exec esbuild scripts/benchmark-map-resource.ts --bundle --platform=node --format=cjs --outfile=/tmp/map-baseline.cjs
```

Use `/tmp/map-reused.cjs` for the changed revision. Both must read the same
repository's local source data and generated registries. Run baseline then
changed in fresh processes, ten pairs for country and five for combined authority:

```sh
node --max-old-space-size=4096 /tmp/map-baseline.cjs /absolute/path/to/data-repository country/2025-12-uk-bgc
node --max-old-space-size=4096 /tmp/map-reused.cjs /absolute/path/to/data-repository country/2025-12-uk-bgc
```

Repeat with `combinedAuthority/2025-12-en-bgc`. Check counts, bytes, and the
aggregate descriptor/artifact hash on every run. `/usr/bin/time -f '%M'` records
peak resident memory in KiB. Profiles, counters, and tests run separately.

## Results

Measured on 2026-10-16 on Linux, Intel Core i5-1235U, 12 logical CPUs, with local
inputs and a warm filesystem cache. Other work on the machine caused timing
drift, so the primary statistic compares each changed run with the baseline
immediately preceding it. An earlier interrupted, heavily contended batch is
excluded. The recorded country batch was extended from five to ten pairs because
the first five were too noisy to establish a gain.

Country compilation was faster in 9 of 10 pairs. The median of the ten paired
elapsed-time reductions, `100 * (1 - changed / baseline)`, was 10.2%. The median
paired CPU reduction was 9.6%. Nine improvements out of ten have an exact
two-sided paired sign-test probability of 0.0215 under equal odds. This is a
consistency check on these runs, not a guarantee for another machine.

The separate elapsed medians were 5.288 s before and 4.418 s after, with ranges
of 4.306 to 7.348 s and 3.958 to 7.464 s. CPU medians were 6.692 s and 5.631 s,
with ranges of 5.365 to 9.464 s and 5.004 to 9.658 s. The ratio of these separate
medians differs from the median paired reduction because the machine's load
drifted. Peak resident memory medians were 494,126 KiB and 473,274 KiB;
ranges were 488,408 to 506,092 KiB and 465,128 to 482,884 KiB.

The combined-authority result is inconclusive. Five runs per version had elapsed
medians of 0.722 s and 0.660 s, with overlapping ranges of 0.712 to 1.143 s and
0.646 to 1.386 s. CPU medians were 0.997 s and 0.913 s, with ranges of 0.987 to
1.674 s and 0.886 to 1.902 s. No speedup is claimed for that release.

All 30 recorded compilations succeeded. Country runs each produced 4 areas,
12,823 tiles, and 18,812,317 artifact bytes, with unchanged aggregate SHA-256:

```text
9c6977d3ffc38f810a410690e0c41afac85619df21c8ce94e2ca80ecbb3cb1de
```

Combined-authority runs each produced 15 areas, 2,578 tiles, and 3,340,006 bytes:

```text
5e580167f1625440cbfcca293f625223d3bef2c3b45544c8886571f65a5f2a5d
```

These measurements cover complete uncached release compilation, including all
geometry tiers and artifact formats. They do not measure all of `build:data` or
incremental cache hits. Tiling, topology construction, and compression remain
costs outside this optimization. Changing the compiler source invalidates the
map-resource build fingerprint, so the next build recompiles cached releases.

## Raw runs

Values are in milliseconds except `maxRssKiB`. Each numbered baseline run was
immediately followed by the corresponding changed run.

`country/2025-12-uk-bgc`:

```text
baseline elapsedMs: 7347.909, 5324.224, 5250.834, 6016.787, 5559.957, 4350.943, 4350.024, 4306.443, 5893.375, 5129.542
baseline cpuMs: 9463.534, 6747.912, 6635.810, 7571.699, 6946.845, 5514.291, 5543.512, 5365.405, 7432.076, 6461.403
baseline maxRssKiB: 499532, 489332, 492492, 488408, 491872, 503092, 506092, 491944, 500596, 495760
reused elapsedMs: 7463.722, 5163.014, 4651.915, 5274.683, 4403.047, 4079.209, 3957.754, 4000.226, 4231.125, 4432.643
reused cpuMs: 9657.717, 6599.697, 5851.387, 6798.866, 5632.026, 5149.851, 5041.540, 5004.494, 5318.066, 5629.212
reused maxRssKiB: 474208, 475700, 477268, 472340, 465128, 470228, 468556, 476832, 482884, 467880
```

`combinedAuthority/2025-12-en-bgc`:

```text
baseline elapsedMs: 721.995, 867.410, 1143.304, 712.444, 718.874
baseline cpuMs: 986.816, 1170.602, 1673.755, 991.564, 997.113
baseline maxRssKiB: 210272, 212580, 212644, 209144, 212176
reused elapsedMs: 646.872, 1385.851, 663.076, 646.018, 660.043
reused cpuMs: 916.857, 1901.637, 912.884, 886.137, 911.952
reused maxRssKiB: 210536, 209312, 210408, 210120, 210636
```
