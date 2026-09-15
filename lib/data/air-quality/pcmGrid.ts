/**
 * Defra's Pollution Climate Mapping (PCM) background maps, and the
 * assignment of their 1x1 km cells to areas.
 *
 * Each map is a CSV with four header rows (pollutant, year, metric, units), a
 * blank row, then one row per cell: a grid code, the cell centre's easting and
 * northing on the British National Grid, and the modelled concentration.
 */

export type PcmGrid = {
	pollutant: string;
	year: number;
	metric: string;
	units: string;
	/** Cell centres and values, in file order. */
	cells: Array<{ gridcode: string; x: number; y: number; value: number }>;
};

export function parsePcmGrid(csv: string): PcmGrid {
	const lines = csv.replace(/^﻿/, "").split(/\r?\n/);
	const field = (index: number) => (lines[index] ?? "").split(",")[0].trim();
	const year = Number(field(1));
	const metric = field(2);
	if (!Number.isInteger(year) || metric !== "annual mean")
		throw new Error(
			`PCM map header must name a year and the annual mean, found "${field(1)}", "${metric}"`,
		);
	const header = (lines[5] ?? "").split(",").map((cell) => cell.trim());
	if (header[0] !== "gridcode" || header[1] !== "x" || header[2] !== "y")
		throw new Error(`PCM map has an unexpected column header: ${lines[5]}`);
	const cells: PcmGrid["cells"] = [];
	for (const line of lines.slice(6)) {
		if (!line.trim()) continue;
		const [gridcode, x, y, value] = line.split(",");
		const parsed = Number(value);
		// The maps mark cells with no modelled value MISSING; none is invented.
		if (value?.trim().toUpperCase() === "MISSING") continue;
		if (!Number.isFinite(parsed) || !Number.isFinite(Number(x)))
			throw new Error(`PCM map row is not a cell: ${line}`);
		cells.push({ gridcode, x: Number(x), y: Number(y), value: parsed });
	}
	return { pollutant: field(0), year, metric, units: field(3), cells };
}

type Ring = number[][];
type PolygonCoordinates = Ring[];
export type AreaGeometry =
	| { type: "Polygon"; coordinates: PolygonCoordinates }
	| { type: "MultiPolygon"; coordinates: PolygonCoordinates[] };

const insideRing = (lon: number, lat: number, ring: Ring) => {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const [xi, yi] = ring[i];
		const [xj, yj] = ring[j];
		if (
			yi > lat !== yj > lat &&
			lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
		)
			inside = !inside;
	}
	return inside;
};

/** Whether a point lies inside a polygon or multipolygon, holes excluded. */
export function pointInGeometry(
	lon: number,
	lat: number,
	geometry: AreaGeometry,
): boolean {
	const polygons =
		geometry.type === "Polygon"
			? [geometry.coordinates]
			: geometry.coordinates;
	return polygons.some(
		([outer, ...holes]) =>
			insideRing(lon, lat, outer) &&
			!holes.some((hole) => insideRing(lon, lat, hole)),
	);
}

type IndexedArea = {
	code: string;
	geometry: AreaGeometry;
	bounds: [number, number, number, number];
};

const boundsOf = (geometry: AreaGeometry): IndexedArea["bounds"] => {
	const bounds: IndexedArea["bounds"] = [
		Infinity,
		Infinity,
		-Infinity,
		-Infinity,
	];
	const polygons =
		geometry.type === "Polygon"
			? [geometry.coordinates]
			: geometry.coordinates;
	for (const [outer] of polygons)
		for (const [lon, lat] of outer) {
			bounds[0] = Math.min(bounds[0], lon);
			bounds[1] = Math.min(bounds[1], lat);
			bounds[2] = Math.max(bounds[2], lon);
			bounds[3] = Math.max(bounds[3], lat);
		}
	return bounds;
};

/**
 * The area each cell's centre falls in, or undefined for a centre in none,
 * such as a coastal cell whose centre lies offshore of a generalised boundary.
 * A cell is given to one area only: the first whose boundary contains its
 * centre, which for a partition of non-overlapping areas is the only one.
 */
export function assignCellsToAreas(
	centres: Array<[number, number]>,
	areas: Array<{ code: string; geometry: AreaGeometry }>,
): Array<string | undefined> {
	const indexed: IndexedArea[] = areas.map((area) => ({
		...area,
		bounds: boundsOf(area.geometry),
	}));
	return centres.map(([lon, lat]) => {
		for (const area of indexed) {
			const [west, south, east, north] = area.bounds;
			if (lon < west || lon > east || lat < south || lat > north)
				continue;
			if (pointInGeometry(lon, lat, area.geometry)) return area.code;
		}
		return undefined;
	});
}
