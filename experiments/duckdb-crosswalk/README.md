# DuckDB area-overlap trial

Run both commands from the repository root after building the area inventory,
geometry source registry, and the relevant crosswalk artifact:

```sh
node --import tsx experiments/duckdb-crosswalk/baseline.mts
node --import tsx experiments/duckdb-crosswalk/trial.mts
```

The default is the national park to local authority crosswalk. Pass another
area-overlap crosswalk ID as the first argument to either command. The baseline
runs the production compiler and checks its content hash against the artifact.
The trial checks source input hashes, reads the same corrected geometry with the
Node loader, and copies it to DuckDB. DuckDB repairs invalid geometry, joins
intersecting polygons, and measures intersection areas in EPSG:6933.

The trial applies the sliver width and reviewed pair decisions to positive-area
intersections in Node. It compares retained pairs and normalized weights with
the published artifact, and reports unresolved widths and inclusions outside
the review band. It does not perform the production coverage, exception
validation, endpoint, or provenance checks. A successful run is not a full
parity check. An input hash match alone does not validate every setting used to
build the reference artifact.

Run the rule fixtures with:

```sh
node --import tsx --test experiments/duckdb-crosswalk/classify.test.mts
```

The baseline time includes geometry loading and production compilation, but
not loading the area inventory. The trial reports Node geometry loading,
DuckDB loading and repair, the DuckDB query, and Node classification separately. The operations differ,
so their times and peak process RSS are not a like-for-like benchmark. Neither
command writes production artifacts. DuckDB may download its spatial extension
on first use.
