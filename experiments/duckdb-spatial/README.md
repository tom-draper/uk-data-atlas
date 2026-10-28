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
