# DuckDB heavy join spike

## Recommendation

Do not adopt DuckDB for the currently configured area-overlap crosswalks. The largest adapters by source count times target count have 650 sources and 361 targets. A fresh Node compile of one of those took 13.14 seconds and peaked at 867 MiB RSS, below the decision limits of two minutes and 1.5 GB. Its output matched the saved content hash. This is one run, and the count product is a selection rule, not a guarantee that every tie has identical geometry cost. The result does not establish memory use for other crosswalk methods or future output-area-scale adapters.

An earlier DuckDB experiment replaced only the bounding-box candidate join. Node still loaded and clipped both geometry releases. It produced identical artifacts for two adapters, but its repeated timing ranges overlapped Node's and it used more peak RSS in those runs. It did not show a reason to change the build. The experimental code and its local spatial fixture are preserved on [spike/duckdb-heavy-joins-code](https://github.com/tom-draper/uk-data-atlas/tree/spike/duckdb-heavy-joins-code). The normal build is unchanged.

## Area-overlap adapter sizes

Counts come from the copied `data/build/artifacts/area-inventory.json` and its release artifacts. For the local-authority-to-region adapter, the source count applies its `^E` source-code filter. The table lists every `area-overlap` adapter in `services/api/config/crosswalk-adapters.json`, ordered by the product of those counts. There are no ward, LSOA or OA area-overlap adapters in this configuration.

| Adapter                                                                                  | Sources | Targets | Product |
| ---------------------------------------------------------------------------------------- | ------: | ------: | ------: |
| `constituency-2024-07-uk-bgc-to-local-authority-2024-05-uk-bgc-area-overlap`             |     650 |     361 | 234,650 |
| `constituency-2022-12-uk-bgc-to-local-authority-2025-05-uk-bgc-v2-area-overlap`          |     650 |     361 | 234,650 |
| `constituency-2024-07-uk-bgc-to-local-authority-2025-05-uk-bgc-v2-area-overlap`          |     650 |     361 | 234,650 |
| `local-planning-authority-2019-04-uk-bgc-to-local-authority-2019-04-uk-bgc-area-overlap` |     400 |     382 | 152,800 |
| `travel-to-work-area-2011-12-uk-gcb-to-local-authority-2019-04-uk-bgc-area-overlap`      |     228 |     382 |  87,096 |
| `major-town-and-city-2015-12-ew-bgc-to-local-authority-2019-04-uk-bgc-area-overlap`      |     112 |     382 |  42,784 |
| `national-park-2020-12-gb-bgc-to-local-authority-2020-12-uk-bgc-area-overlap`            |      15 |     379 |   5,685 |
| `local-authority-2025-12-uk-bgc-to-region-2025-12-en-bgc-area-overlap`                   |     296 |       9 |   2,664 |
| `nhs-england-region-2022-07-en-bgc-to-nhs-england-region-2024-01-en-bgc-area-overlap`    |       7 |       7 |      49 |

## Measurements

Measured on Linux x86-64 with 12 logical CPUs, 7.6 GiB RAM, Node 26.10.0, pnpm 12.5.1 and DuckDB 1.4.5. Each `/usr/bin/time -v` measurement includes process startup, input loading, compilation and output. Maximum RSS is the largest individual process reported by time, not the sum of the process tree. Runs used one crosswalk worker and did not overlap other heavy builds. The source data and previous build artifacts were copied to an independent worktree.

| Work                                  | Runs |               Wall seconds |              Peak RSS MiB | Work performed                                        |
| ------------------------------------- | ---: | -------------------------: | ------------------------: | ----------------------------------------------------- |
| Largest adapter, Node, fresh compile  |    1 |                      13.14 |                       867 | 650 records; saved hash matched                       |
| Crosswalk inventory, incremental      |    1 |                       9.69 |                       739 | Reused 166 artifacts and compiled 15 official lookups |
| NHS region overlap, Node              |    5 | 6.25 median (5.83 to 7.20) |   871 median (823 to 873) | Seven source records                                  |
| NHS region overlap, DuckDB candidates |    5 | 6.68 median (6.01 to 7.35) | 884 median (871 to 1,065) | 27 candidate pairs, seven source records              |
| Largest adapter, DuckDB candidates    |    1 |                      12.58 |                       941 | 3,600 candidate pairs, 650 source records             |

The deciding run used `profile-crosswalks.ts` in a new process. It compiled from the raw geometry files and wrote the artifact in a temporary directory without using the crosswalk artifact cache. The operating-system page cache was not cleared, so this is a cold compiler run, not a guaranteed cold-disk measurement. It reported `sha256:5ecf406ed595ea270efb3693662f71b61e664b51309019ca417527095fe29ece` and verified that hash against the stored artifact. Its process exited successfully. The three largest products tie; the 2024 constituency to 2024 local-authority adapter was selected from that tie.

The five-run NHS comparisons alternated Node and DuckDB on base commit `ad5033cc`. Their ranges overlap, so the speed comparison is inconclusive. The other DuckDB timing is one run, not a speed claim. No CPU or I/O profiler was run, so the limiting operation has not been established. The incremental inventory timing is not a full rebuild. Earlier map-resource measurements were removed because main has since changed map-download generation.

DuckDB used `memory_limit='2GB'` and a private temporary directory. Sampling that directory every 25 ms observed zero bytes in the candidate-join runs. This is a sampled lower bound and does not rule out shorter-lived files. The limit covers DuckDB-managed memory, not the Node heap or the entire process. The candidate-join prototype materializes candidate pairs in Node and does not bound the memory used by geometry or result arrays. A full DuckDB geometry join was not attempted because the Node deciding run met both limits.

## Equivalence

The NHS region run produced seven records and content hash `sha256:e9a4a5e5af18c3f392f44446331daa10759f67a5964465f82a82d7ed87411cac` in all ten repeated runs. The 650-record constituency run produced `sha256:5ecf406ed595ea270efb3693662f71b61e664b51309019ca417527095fe29ece` on both paths. The Node profiler checked both hashes against stored artifacts. The hashes cover the complete serialized crosswalk content, including records, validation and provenance. The code branch also has a local fixture for touching bounds and candidate ordering. These checks do not prove equivalence for every adapter or for a different clipping algorithm.

## Installation and complexity

The workspace already depends on `@duckdb/node-api` 1.4.5-r.1. Its installed Linux x64 binding occupies about 63 MiB, the API and wrapper about 1 MiB, and the separately downloaded spatial extension 84 MiB. These are local on-disk sizes, not compressed download sizes.

A frozen workspace `pnpm install` succeeded locally. The API Dockerfile built successfully and its build-stage install downloaded the native binding. A separate `node:24-bookworm-slim` container installed the same package and loaded the binding with `SELECT 1`. The production API image copies the bundled API output, not the pipeline or the extension. GitHub Actions is disabled for this repository, so the CI install could not be verified.

The prototype needs a second spatial index implementation, a temporary directory and native extension setup. It preserves the existing shared-arc tiler and boundary mappings. Its extra candidate list and retained Node geometry make it unsuitable as a memory fix in its current form.

## Reproduce the deciding run

With source data and prerequisite build artifacts present, check for other heavy work before starting. Wait if another build is running.

```sh
ps aux | grep -E 'node|tsx|duckdb'
/usr/bin/time -v pnpm exec tsx --max-old-space-size=3072 pipeline/src/profile-crosswalks.ts --workers=1 constituency-2024-07-uk-bgc-to-local-authority-2024-05-uk-bgc-area-overlap
```
