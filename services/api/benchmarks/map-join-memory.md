# Map join memory

The map-resource join now builds Parquet columns directly. The writer encodes
string and binary columns into one buffer instead of allocating a length buffer,
a value buffer and intermediate arrays for every cell. Required columns also
avoid unnecessary filtered copies. JSON row order, Parquet rows and file bytes
remain unchanged for joins within the new budgets.

## Isolated writer measurement

One fresh Linux process per version, Node v26.11.1, 768 MiB V8 heap limit,
250,000 rows and four required columns: integer id, string code, numeric value
and string status. Garbage collection runs after building the input arrays and
before timing the writer. The baseline writer is from `94b1a5d1`.

| Measurement      |          Before |           After |
| ---------------- | --------------: | --------------: |
| Process peak RSS |       320.2 MiB |       121.7 MiB |
| Writer CPU time  |        876.6 ms |        303.0 ms |
| Output size      | 1,740,587 bytes | 1,740,587 bytes |

Both files have SHA-256
`df9103133bf62aa5902145cc7e7adac310c96902381762f3a273e5d15c083593`.
A real 35,672-row LSOA join also produced identical JSON and Parquet digests
before and after the allocation change.

These are single local measurements, not production savings or an RSS ceiling.
Process peak RSS includes input construction and module startup. The host was
busy, so wall-clock times are not used to compare performance. The synthetic
writer workload isolates the allocation change; whole API workers also retain
catalogues, observations and geometry caches.

Run from the repository root:

```sh
git show 94b1a5d1:services/api/src/parquet.ts > /tmp/atlas-parquet-before.mts
node --expose-gc --max-old-space-size=768 --import tsx services/api/scripts/benchmark-parquet.ts 250000 /tmp/atlas-parquet-before.mts
node --expose-gc --max-old-space-size=768 --import tsx services/api/scripts/benchmark-parquet.ts 250000
```

The benchmark exits nonzero for invalid inputs or a writer failure. Compare
`bytes` and `sha256` before comparing memory; a mismatch invalidates a claim of
unchanged output. It reports CPU time separately from elapsed time. Repeat the
runs on an idle host before choosing production limits.

## Join budgets

Both JSON and Parquet joins accept at most 250,000 source records and 16 MiB of
uncompressed column payload. The byte charge is 20 bytes per numeric row plus
UTF-8 code and status bytes. Refusals return `422 Map Join Budget Exceeded`,
with no partial table and a `links.data` URL for paginated source observations.
The check precedes output construction but follows source record materialisation.
These budgets do not bound source parsing, JSON escaping overhead or total RSS.

CSV and NDJSON observation exports already limit pages to 500 records. Large
prebuilt boundary downloads stream from disk. This change does not introduce
streaming for generated join tables.
