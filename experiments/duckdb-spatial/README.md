# DuckDB spatial trial

Run from the repository root:

```sh
./node_modules/.bin/tsx experiments/duckdb-spatial/trial.mts
```

DuckDB downloads its spatial extension on first use. The trial compares a small
set of points and polygons against the current containment code. It includes
shared edges, a hole, a multipolygon and points within the existing boundary
tolerance. It asserts the ordinary cases and records the differences for the
near-boundary cases. It also checks that a DuckDB bounding-box join followed by
the Node containment check produces the same matches on this fixture.

The trial does not calculate boundary distances or exercise real data, and it
does not change the postcode-area build. A successful run does not establish
full parity or performance on production data.

## Production data trial

Run the trial from the repository root after building the postcode index and
geometry store:

```sh
./node_modules/.bin/tsx experiments/duckdb-spatial/production-trial.mts
```

The trial samples every fortieth postcode and compares containment for the
2024 local authority release. It reports differences and timings without
changing the build artifacts. The Node timing also includes boundary-distance
calculations, which the DuckDB query does not perform. Loading the common
postcode and geometry inputs is outside both timings, while DuckDB's loading
time includes copying the inputs into its tables. The single process peak RSS
covers both implementations and is not a per-implementation measurement.
