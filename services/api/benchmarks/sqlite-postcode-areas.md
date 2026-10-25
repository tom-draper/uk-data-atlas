# SQLite postcode areas

Measured on 2026-10-25 with Node 26.12.1, on the same machine and filesystem,
with one heavy process at a time and `NODE_OPTIONS=--max-old-space-size=2560`.
The [raw results](sqlite-postcode-areas.json) include `dbstat` bytes for every
SQLite table and index, plus all timing samples.

The main checkout's database still used the schema before PR #388. The baseline
therefore copies that database and precompiled files with `cp --reflink=auto`,
then rebuilds only `areaTables` and `crosswalkTables` using the parent branch's
`writeSqliteTables`, followed by `VACUUM`. This uses the parent revision
`ca2b738861c008021880274d64f8584172358132`. Postcode tables, shards and payloads
remain unchanged. The baseline database is
`data/build/atlas-postcode-before.sqlite`; the converted database is
`data/build/atlas.sqlite`. No precompile stages ran. Dependencies were installed
with `pnpm install` in the worktree.

## Results

All 3,044 postcode shards and all 3,044 postcode-area shards compare byte for
byte, with zero mismatches. Both sides also match the original manifest hashes.
The postcode and postcode-area manifest payloads remain byte-identical.
`PRAGMA foreign_key_check` returns no violations.

The database grows from 787,324,928 to 1,145,368,576 bytes, an increase of
358,043,648 bytes, or 45.5%. These are both vacuumed databases on the parent
area-ID schema. The copied main-checkout database was 1,609,543,680 bytes before
the parent schema changes, so comparing that file directly would hide the
postcode normalization cost.

Changed storage, in bytes:

- `postcodes`: 103,804,928 before, 620,154,880 after.
- Separate postcode autoindex: 50,028,544 before, removed after.
- `postcode_area_shards`: 118,419,456 before, removed after.
- `postcode_area_codes`: 6,975,488 after.
- `postcode_area_columns`: 1,196,032 after.
- `postcode_area_matches`: 454,656 after.
- `postcode_area_releases`: 4,096 after, plus two 4,096-byte indexes.

A single `postcodes` table lets users join directly through an area ID, without
repeating 2,665,797 postcode keys in a separate wide table. The postcode primary
key replaces both stored district positions and the duplicate postcode index.
District order is rebuilt from compact postcode order and verified against every
original shard. Release-qualified columns keep historical releases distinct.

Queryable integer IDs and distances take more space than compressed JSON.
This change favors SQL access over minimum download size and shard-read speed.
No compressed copy of the area mappings remains.

## Read timings

Each operation warms once, then runs nine times on a fresh read-only connection.
The numbers below are medians with a warm filesystem cache, not cold-start API
latencies. The API retains its existing bounded district caches.

- Load the largest district's area shard, SE1 with 3,682 postcodes:
  2.497 ms before, 57.831 ms after, about 23.2 times slower.
- Direct `SELECT * FROM postcodes WHERE postcode = 'SW1A1AA'` lookup:
  0.349 ms before, 0.506 ms after. The new row also includes area IDs and distances.

The old area reader inflates the stored blob. The new reader reconstructs the
JSON from relational rows and verifies its SHA-256 before returning it.

## Reproduce the conversion and comparison

After preparing a parent-schema baseline and retaining a copy, run these from
the repository root:

```sh
NODE_OPTIONS=--max-old-space-size=2560 npx tsx services/api/scripts/normalize-postcode-areas.ts
NODE_OPTIONS=--max-old-space-size=2560 npx tsx services/api/scripts/compare-postcode-sqlite.ts data/build/atlas-postcode-before.sqlite services/api services/api/benchmarks/sqlite-postcode-areas.json
```

The conversion exits nonzero if a reconstructed area shard differs. The comparison
requires nonempty inventories and exits nonzero on a byte mismatch, hash mismatch,
changed manifest payload or foreign-key violation. The JSON result must report
3,044 comparisons of each shard type and zero mismatches for this dataset.

## Checks

From `services/api`, with `NODE_OPTIONS=--max-old-space-size=2560`:

```sh
npx tsx --test --test-concurrency=2 tests/atlasPostcodes.test.ts tests/atlasPostcodeDerived.test.ts tests/postcodes.test.ts tests/postcodeAreas.test.ts tests/postcodeRoutes.test.ts tests/postcodeValueRoutes.test.ts tests/atlasSqlite.test.ts tests/lazyCatalogues.test.ts
npx tsc --noEmit
```

The test runner reports 62 passed, zero failed and zero skipped. A nonzero exit
or zero executed tests is a failure. TypeScript exits zero with no diagnostics;
a nonzero exit is a failure.
