# DuckDB heavy join spike

## Recommendation

Do not replace the crosswalk or map-resource stages with this approach yet. The DuckDB candidate join produced identical crosswalks for both inputs tested, but it did not show a measurable improvement on the repeated comparison and used more peak memory in these runs. This experiment only moves bounding-box candidate selection to DuckDB. Node still reads both releases into memory, clips polygons, applies sliver rules and writes the artifact. It cannot establish whether a fully streamed DuckDB spatial join would avoid the memory ceiling. Test that separately on an output-area-scale join before deciding whether to migrate geometry processing.

## Measurements

Measured on 2026-11-01 on Linux x86-64, 12 logical CPUs, 7.6 GiB RAM, Node 26.10.0, pnpm 12.5.1, DuckDB 1.4.5 and the spatial extension. Each `/usr/bin/time -v` measurement includes process startup, input loading, compilation and output. Maximum RSS is the largest individual process reported by time, not the sum of the process tree. Stages ran one at a time with one crosswalk worker. Inputs and previous build artifacts were copied into an independent worktree. The stage runs use the configured `data:build` stage commands through `runBuild`, with dependency stages excluded because their outputs already existed.

| Work                                                           | Runs |               Wall seconds |              Peak RSS MiB | Work performed                                                                                                                |
| -------------------------------------------------------------- | ---: | -------------------------: | ------------------------: | ----------------------------------------------------------------------------------------------------------------------------- |
| Crosswalk inventory, incremental                               |    1 |                       9.69 |                       739 | Reused 166 artifacts, compiled 15 official lookups                                                                            |
| Map resources, incremental                                     |    1 |                       1.27 |                       353 | Reused cached results, 101 resources and 14 unavailable releases                                                              |
| Country map release, uncached                                  |    1 |                       4.06 |                       475 | Four areas, 12,823 tiles, five download files; output hash `6051f0344062cc9ccbb6f9b22c9a9f56616becab0c494b55e77dfc68acf176b0` |
| NHS region overlap, Node                                       |    5 | 6.25 median (5.83 to 7.20) |   871 median (823 to 873) | Seven source records                                                                                                          |
| NHS region overlap, DuckDB candidate join                      |    5 | 6.68 median (6.01 to 7.35) | 884 median (871 to 1,065) | 27 candidate pairs, seven source records                                                                                      |
| Constituency to local authority overlap, Node                  |    1 |                      12.74 |                       877 | 650 source records                                                                                                            |
| Constituency to local authority overlap, DuckDB candidate join |    1 |                      12.58 |                       941 | 3,600 candidate pairs, 650 source records                                                                                     |

The five-run comparisons alternated Node and DuckDB. Their wall-time ranges overlap, so the result is inconclusive for speed. The larger comparison has only one run per side and is not a speed claim. No CPU or I/O profiler was run, so the limiting operation has not been established. The incremental measurements are not full rebuild timings. The map benchmark initially failed because it expected eight download files after the compiler changed to five; the successful timing uses the corrected assertion.

DuckDB was configured with `memory_limit='2GB'` and a private temporary directory. Sampling that directory every 25 ms observed zero bytes in each DuckDB run. This is a sampled lower bound, not proof that no shorter-lived files existed. These inputs did not demonstrate spilling. The limit covers DuckDB-managed memory, not the Node heap or the entire process. The DuckDB variant materializes the candidate pairs in Node and therefore does not bound the memory used by its geometry or result arrays.

## Equivalence

The NHS region run produced seven records and content hash `sha256:e9a4a5e5af18c3f392f44446331daa10759f67a5964465f82a82d7ed87411cac` in all ten repeated runs. The Node profiler also checked that hash against the stored artifact. The 650-record constituency run produced `sha256:5ecf406ed595ea270efb3693662f71b61e664b51309019ca417527095fe29ece` on both paths, and the Node profiler matched the stored artifact. These hashes cover the complete serialized crosswalk content, including records, validation and provenance. No output differences were observed for these inputs. They do not prove equivalence for every adapter or for a replacement of the clipping algorithm.

## Installation and complexity

The workspace already depends on `@duckdb/node-api` 1.4.5-r.1, so this experiment adds no package dependency. Its installed Linux x64 binding occupies about 63 MiB, the API and wrapper about 1 MiB, and the separately downloaded spatial extension 84 MiB. These are local on-disk sizes, not compressed download sizes. The spatial extension must be installed before the command can load it.

A frozen workspace `pnpm install` succeeded locally. The API Dockerfile built successfully and its build-stage install downloaded the native binding. A separate `node:24-bookworm-slim` container installed the same package and loaded the binding with `SELECT 1`. The production API image copies the bundled API output, not the pipeline or the extension. CI's full workspace install and `pnpm check` run on GitHub remain to be confirmed by the PR checks; the local install alone does not establish CI success.

The prototype needs a second spatial index implementation, a temporary directory and native extension setup. It preserves the existing shared-arc tiler and boundary mappings. Its extra candidate list and retained Node geometry make it unsuitable as a memory fix in its current form. A larger redesign would need to stream geometry into DuckDB, retain the current corrections and sliver decisions, and demonstrate matching results without materializing both releases in Node.

## Reproduce

With source data and the prerequisite build artifacts in the worktree, install the matching spatial extension once. The extension is downloaded to DuckDB's user extension directory:

```sh
node --input-type=module -e 'import {DuckDBInstance} from "@duckdb/node-api"; const d=await DuckDBInstance.create(":memory:"); const c=await d.connect(); await c.run("SET memory_limit=\u00272GB\u0027"); await c.run("SET temp_directory=\u0027/tmp/atlas-duckdb-install\u0027"); await c.run("INSTALL spatial"); c.closeSync(); d.closeSync();'
```

Before each run, inspect `ps aux | grep -E 'node|tsx|duckdb'` and wait for other heavy builds. For example:

```sh
id=constituency-2024-07-uk-bgc-to-local-authority-2024-05-uk-bgc-area-overlap
/usr/bin/time -v pnpm exec tsx --max-old-space-size=3072 pipeline/src/profile-crosswalks.ts --workers=1 "$id"
/usr/bin/time -v pnpm exec tsx --max-old-space-size=3072 pipeline/src/spike-duckdb-crosswalk.ts "$id" /tmp/duckdb-crosswalk.json
```

The experimental command accepts an area-overlap adapter and an output path. It uses DuckDB spatial `ST_Intersects` on bounding envelopes, ordered by the original source and target positions, then passes the candidates through the unchanged Node clipping and validation. The existing build remains the default. Self-joins with a source-code filter are rejected by the experiment.
