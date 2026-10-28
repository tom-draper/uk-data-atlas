# DuckDB postcode counts trial

This experiment uses the Node DuckDB client to aggregate postcode counts. It
compares the resulting artifact hash with the current cache and
publishes it to a temporary SQLite cache copy. The data build uses the same
aggregation after validating its input shards. The trial does not alter the
production cache.

The seal command first validates the existing postcode and area shards, then
records a SHA-256 fingerprint of the complete database. The trial checks that
fingerprint before and after aggregation. This detects changes to any database
byte, including changes that leave the data structurally valid. The seal must
be trusted and stored separately from the database. This is an integrity check,
not a signature against an attacker who can change both files. The command
rejects databases with a WAL or rollback journal.

Sealing still pays the full shard validation cost. Any database change, even an
unrelated one, requires a new seal and validation. This experiment therefore
measures repeated reads of an already validated database, not the cost of a
fresh production build.

Install the workspace dependencies with `pnpm install`. DuckDB's SQLite
extension must be available; `LOAD sqlite` can download it if it is not already
installed. The full trial requires built `data/build/atlas.sqlite` and current
`data/build/atlas-cache.sqlite` files. To compare with the Node implementation,
first rebuild the current cache with this command:

```sh
./node_modules/.bin/tsx services/api/scripts/build-postcode-counts.ts
```

This updates `data/build/atlas-cache.sqlite`. Without this step, the trial
compares against whatever counts the cache currently contains.

From the repository root, run:

```sh
./node_modules/.bin/tsx experiments/duckdb-postcode-counts/aggregate.test.mts
./node_modules/.bin/tsx experiments/duckdb-postcode-counts/integrity.test.mts
./node_modules/.bin/tsx experiments/duckdb-postcode-counts/seal.mts /tmp/atlas-integrity.json
./node_modules/.bin/tsx experiments/duckdb-postcode-counts/trial.mts /tmp/atlas-integrity.json
```

For a fresh build trial without a seal, replace the seal path in the trial command
with `--fresh`. This validates the shards and fingerprints the database within
the same run, so its timing includes validation.

The seal command refuses to overwrite an existing file. Use a new path when
sealing another database. The fixture checks normal and multiple-area matches,
terminated postcodes, large users, database changes and journal detection. The
full trial prints the district, release and count totals, stage timings, peak
process memory and artifact hash. A nonzero exit signals a failure, including
an input validation error or a difference from the cached artifact. The
temporary cache is removed after normal completion or a handled error.
