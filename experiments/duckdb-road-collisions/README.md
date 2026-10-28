# DuckDB road collision trial

Run this experiment from the repository root after installing dependencies and
placing the 2024 and 2025 road collision CSVs under
`data/source/transport/road-safety`:

```sh
./node_modules/.bin/tsx experiments/duckdb-road-collisions/trial.mts
```

The trial runs the production Node loader and a separate DuckDB implementation
three times each in alternating order. DuckDB reads each CSV directly and groups
collisions by local authority and LSOA. Each run compares the complete dataset
objects, including exclusions, coverage and severity counts, and checks their
serialized order. A mismatch or a failed child process exits nonzero.

The timings include reading the source files and constructing the returned
objects. They exclude writing and comparing the temporary output files. Peak
RSS is measured separately for each child process. The trial does not publish
artifacts or change the production pipeline. It compares the two local annual
files, not all possible malformed inputs or the complete data build. Operating
system file caches and machine load can affect timings.

Run the fixture checks with:

```sh
./node_modules/.bin/tsx --test experiments/duckdb-road-collisions/fixtures.test.mts
```

The fixtures compare valid results and rejection of invalid severity, dates,
years, missing months, empty input, and duplicate years. They do not cover every
CSV parsing error or prove parity for every possible input.
