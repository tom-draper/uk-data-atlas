/**
 * Thins an over-dense published boundary GeoJSON down to a size that can be
 * checked in, without changing where any boundary runs by more than a
 * generalised release already allows.
 *
 * ONS's 2022 re-issue of the December 2001 LSOAs is labelled BGC (generalised
 * to 20 m, clipped) but keeps a vertex every 20–30 m along each line: 8.2M
 * vertices and 312 MB, against 2.05M vertices and 86 MB for the 2011 BGC
 * release of the same areas. GitHub refuses any file over 100 MB, so it cannot
 * be committed as published.
 *
 * Simplification runs on a shared topology, so a border between two areas is
 * one arc simplified once, and neighbours can never gap or overlap. The
 * Visvalingam weight threshold is chosen as a quantile, so the result keeps
 * the stated share of vertices; coordinates are rounded to 7 decimal places
 * (about 1 cm), far finer than a 20 m generalisation.
 *
 * Usage:
 *   npx tsx scripts/simplify-boundary-source.mts <published.geojson> \
 *     <out.geojson> [--keep 0.25]
 */
import { readFile, stat, writeFile } from "fs/promises";
import { feature } from "topojson-client";
import { topology } from "topojson-server";
import { presimplify, quantile, simplify } from "topojson-simplify";
import type { FeatureCollection, Geometry, Position } from "geojson";
import type { Topology } from "topojson-specification";

const round = (n: number) => Math.round(n * 1e7) / 1e7;

type Coordinates = Position | Coordinates[];

function roundCoordinates(coordinates: Coordinates): Coordinates {
	return typeof coordinates[0] === "number"
		? (coordinates as Position).map(round)
		: (coordinates as Coordinates[]).map(roundCoordinates);
}

function countVertices(collection: FeatureCollection): number {
	let count = 0;
	const walk = (coordinates: Coordinates) => {
		if (typeof coordinates[0] === "number") count += 1;
		else (coordinates as Coordinates[]).forEach(walk);
	};
	for (const f of collection.features) {
		if (f.geometry && "coordinates" in f.geometry) {
			walk(f.geometry.coordinates as Coordinates);
		}
	}
	return count;
}

/** Rings with fewer than four positions are not valid polygons. */
function countDegenerateRings(collection: FeatureCollection): number {
	let count = 0;
	for (const f of collection.features) {
		const g = f.geometry as Geometry;
		const polygons =
			g.type === "Polygon"
				? [g.coordinates]
				: g.type === "MultiPolygon"
					? g.coordinates
					: [];
		for (const polygon of polygons) {
			for (const ring of polygon) if (ring.length < 4) count += 1;
		}
	}
	return count;
}

async function main() {
	const [input, output] = process.argv.slice(2);
	const keepFlag = process.argv.indexOf("--keep");
	const keep = keepFlag > 0 ? Number(process.argv[keepFlag + 1]) : 0.25;
	if (!input || !output || !(keep > 0 && keep <= 1)) {
		throw new Error(
			"Usage: simplify-boundary-source.mts <in.geojson> <out.geojson> [--keep 0.25]",
		);
	}

	const source = JSON.parse(
		await readFile(input, "utf8"),
	) as FeatureCollection;
	const before = countVertices(source);

	// No quantisation: arcs keep the published coordinates until rounding.
	const topo = presimplify(
		topology({ boundaries: source }) as Topology,
	) as Topology;
	// Weights are ranked largest first, so this is the weight the kept share
	// of interior vertices reaches; arc endpoints are always kept.
	const simplified = simplify(topo, quantile(topo, keep));
	const result = feature(
		simplified,
		simplified.objects.boundaries,
	) as FeatureCollection;

	const out: FeatureCollection = {
		...source,
		features: result.features.map((f) => ({
			...f,
			geometry: {
				...f.geometry,
				coordinates: roundCoordinates(
					(f.geometry as { coordinates: Coordinates }).coordinates,
				),
			} as Geometry,
		})),
	};

	await writeFile(output, JSON.stringify(out));
	const after = countVertices(out);
	const degenerate = countDegenerateRings(out);
	console.log(
		`${out.features.length} features: ${before.toLocaleString("en-GB")} → ${after.toLocaleString("en-GB")} vertices (${((after / before) * 100).toFixed(1)}%), ${((await stat(input)).size / 1e6).toFixed(0)} MB → ${((await stat(output)).size / 1e6).toFixed(0)} MB, ${degenerate} degenerate rings.`,
	);
	if (out.features.length !== source.features.length) {
		throw new Error("Simplification changed the number of features");
	}
}

main();
