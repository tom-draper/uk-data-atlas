# SQLite connection pragmas

Measured on 2026-11-04 with Node 26.10.0 (SQLite 3.53.4) on WSL2 (12 CPUs,
7.7 GB RAM, ext4), against the real `atlas.sqlite` (1.19 GB, 4 KB pages) and
`atlas-cache.sqlite` (178 MB), opened read only through
`openReadOnlyDatabase`. One process per configuration, one at a time. Script:
`scripts/benchmark-sqlite-pragmas.ts`. Pragmas are set with the module's own
environment variables.

Cold means the first pass in a fresh process after the files' clean pages were
dropped with `dd iflag=nocache count=0` (`posix_fadvise(DONTNEED)`, no root).
Dropping the OS page cache itself needs root, and WSL2's host may still cache
the disk, so cold here is warmer than a first read on a real disk. Warm repeats
the same work. Timings on this machine vary by 10 to 20% between identical runs
(swap was in use), so smaller differences are noise.

Workload: 1,000 random postcode district reads, 1,000 area lookups (by code,
then name), three series of observations (2,161, 7,608 and 35,672 rows), `SELECT
count(*), sum(value) FROM observation`, one `v_observation` filter by dataset
and area, and 300 `payloads` reads from the cache file.

Configurations (cache in KiB, mmap in bytes, each alone on the baseline):
baseline (`query_only` off, `temp_store` default, cache 2000, mmap 0),
`query_only`, `temp_store` memory, cache 32 MiB, cache 128 MiB, mmap 256 MiB,
mmap 2 GiB (SQLite clamps to 2,147,418,112), and combination A (all four
guards on, cache 32 MiB, mmap 256 MiB).

## Postcode and area reads (3 rounds pooled, p50 / p95 ms)

| config    | cold shard  | cold area   | warm shard  | warm area   |
| --------- | ----------- | ----------- | ----------- | ----------- |
| baseline  | 1.31 / 4.57 | 0.45 / 0.86 | 0.80 / 2.27 | 0.01 / 0.02 |
| cache-32m | 1.36 / 4.50 | 0.44 / 0.67 | 0.84 / 2.58 | 0.01 / 0.03 |
| mmap-256m | 1.31 / 4.32 | 0.01 / 0.03 | 0.83 / 2.42 | 0.01 / 0.02 |
| mmap-2g   | 0.94 / 7.08 | 0.01 / 0.03 | 0.75 / 2.05 | 0.01 / 0.01 |

## Observations, aggregate, view and cache (3 rounds pooled, p50 / p95 ms)

| config     | cold series | cold aggregate | cold view | cold payload | warm series | warm aggregate | warm view | warm payload |
| ---------- | ----------- | -------------- | --------- | ------------ | ----------- | -------------- | --------- | ------------ |
| baseline   | 16.5 / 64.7 | 411 / 441      | 190 / 214 | 0.05 / 2.02  | 7.3 / 36.3  | 340 / 430      | 183 / 235 | 0.03 / 0.11  |
| query_only | 17.4 / 62.0 | 387 / 471      | 179 / 250 | 0.05 / 1.50  | 6.8 / 36.3  | 356 / 459      | 165 / 200 | 0.04 / 0.07  |
| temp_store | 15.6 / 66.4 | 469 / 470      | 205 / 212 | 0.04 / 1.87  | 6.6 / 36.7  | 344 / 583      | 191 / 350 | 0.03 / 0.10  |
| cache-32m  | 15.4 / 66.1 | 431 / 465      | 186 / 186 | 0.05 / 1.67  | 6.2 / 31.1  | 341 / 376      | 172 / 177 | 0.02 / 0.06  |
| mmap-256m  | 30.2 / 62.3 | 447 / 523      | 194 / 220 | 0.06 / 8.25  | 7.2 / 34.7  | 340 / 425      | 168 / 201 | 0.02 / 0.04  |
| mmap-2g    | 40.4 / 66.2 | 393 / 436      | 183 / 191 | 0.09 / 8.49  | 7.2 / 35.1  | 311 / 357      | 164 / 186 | 0.01 / 0.07  |
| combo-a    | 29.3 / 65.1 | 492 / 500      | 207 / 220 | 0.05 / 6.38  | 7.7 / 35.9  | 404 / 463      | 194 / 223 | 0.04 / 0.06  |

## Memory, one process, full workload (single run, MiB)

| config     | after open | after cold | after warm | warm anon | warm file | peak |
| ---------- | ---------- | ---------- | ---------- | --------- | --------- | ---- |
| baseline   | 86         | 162        | 210        | 158       | 52        | 213  |
| query_only | 88         | 168        | 215        | 165       | 50        | 218  |
| temp_store | 87         | 161        | 209        | 160       | 48        | 211  |
| cache-32m  | 88         | 198        | 234        | 192       | 43        | 243  |
| cache-128m | 88         | 291        | 292        | 279       | 13        | 310  |
| mmap-256m  | 88         | 139        | 169        | 155       | 14        | 216  |
| mmap-2g    | 87         | 262        | 260        | 200       | 60        | 318  |
| combo-a    | 87         | 187        | 207        | 191       | 17        | 248  |

`warm anon` and `warm file` are `RssAnon` and `RssFile` from
`/proc/self/status`. A page cache of N KiB adds up to N KiB of anonymous
memory per connection. Mapped pages are file-backed and shared with every
other process that maps the same file and with the OS page cache, but each
process's RSS counts the pages it has touched. In the postcode and area run a
2 GiB mapping reached 484 MiB of file RSS, and 232 MiB in the observation run;
it grows toward the file size as more is read.

## Reading the results

- `query_only` and `temp_store`: no difference beyond noise, no memory change.
  None of these reads spills a sort or builds a temporary table.
- Page cache 32 MiB and 128 MiB: no latency gain, 30 to 120 MiB more anonymous
  memory per process. The OS page cache already serves repeated reads.
- mmap: area lookups drop from 0.45 ms to 0.01 ms cold, because they skip
  `pread`. Warm lookups are the same with or without it. Cold bulk reads get
  worse (series 16 ms to 30 to 40 ms p50, cache payloads 2 ms to 8 ms p95)
  from page faults, and file RSS grows with use.
- The aggregate and the view filter are CPU bound on warm pages (about 340 ms
  and 170 ms) and no pragma moves them.

So the defaults only turn on `query_only`. The other three are left at SQLite's
values and are tunable through the environment variables in
`data/build/README.md`.
