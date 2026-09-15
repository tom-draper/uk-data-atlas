/**
 * Builds the local authority means of Defra's PCM background maps.
 *
 * Each 1x1 km cell is given to the December 2024 local authority whose
 * boundary contains its centre, and an authority's value is the mean of its
 * cells: the average modelled background concentration across its area. The
 * result is committed beside the maps it came from, so the website's
 * precompile reads a small table rather than repeating the spatial join.
 *
 * Run via: npx tsx scripts/compile-air-quality.mts
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import proj4 from "proj4";
import {
	assignCellsToAreas,
	parsePcmGrid,
	type AreaGeometry,
} from "../lib/data/air-quality/pcmGrid";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIRECTORY = join(ROOT, "data", "environment", "air-quality");
const BOUNDARIES = join(
	ROOT,
	"data",
	"boundaries",
	"local-authority",
	"2024-12-uk-bgc",
	"Local_Authority_Districts_December_2024_Boundaries_UK_BGC_7423724764112241180.geojson",
);
export const OUTPUT = "pcm-background-by-local-authority-2024.csv";

// British National Grid to WGS 84 through EPSG:1314, as the API's
// reprojection uses. Its metre-scale error cannot move a cell centre, 500 m
// from any cell edge, across an authority boundary it was not already near.
const toLonLat = proj4(
	"+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 " +
		"+ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 " +
		"+units=m +no_defs",
	"+proj=longlat +datum=WGS84 +no_defs",
);

const maps = {
	no2Mean: parsePcmGrid(
		readFileSync(join(DIRECTORY, "mapno22024.csv"), "utf8"),
	),
	pm10Mean: parsePcmGrid(
		readFileSync(join(DIRECTORY, "mappm102024g.csv"), "utf8"),
	),
	pm25Mean: parsePcmGrid(
		readFileSync(join(DIRECTORY, "mappm252024g.csv"), "utf8"),
	),
};
// Cells are matched by grid code: a map may mark a cell MISSING that another
// models, and a pollutant's mean is then over the cells it models.
const cellsByCode = new Map<string, { x: number; y: number }>();
for (const map of Object.values(maps)) {
	if (map.year !== maps.no2Mean.year)
		throw new Error("The PCM maps are not for one year");
	for (const { gridcode, x, y } of map.cells) {
		const known = cellsByCode.get(gridcode);
		if (known && (known.x !== x || known.y !== y))
			throw new Error(`PCM maps place cell ${gridcode} differently`);
		cellsByCode.set(gridcode, { x, y });
	}
}
const gridcodes = [...cellsByCode.keys()];
const boundaries = JSON.parse(readFileSync(BOUNDARIES, "utf8")) as {
	features: Array<{
		properties: { LAD24CD: string; LAD24NM: string };
		geometry: AreaGeometry;
	}>;
};
const names = new Map(
	boundaries.features.map((f) => [
		f.properties.LAD24CD,
		f.properties.LAD24NM,
	]),
);
const assigned = assignCellsToAreas(
	gridcodes.map((gridcode) => {
		const { x, y } = cellsByCode.get(gridcode)!;
		return toLonLat.forward([x, y]) as [number, number];
	}),
	boundaries.features.map((f) => ({
		code: f.properties.LAD24CD,
		geometry: f.geometry,
	})),
);
const areaOf = new Map(gridcodes.map((gridcode, i) => [gridcode, assigned[i]]));

type Pollutant = keyof typeof maps;
const pollutants = Object.keys(maps) as Pollutant[];
const totals = new Map<
	string,
	{ cells: number } & Record<Pollutant, { sum: number; cells: number }>
>();
const totalFor = (code: string) => {
	let total = totals.get(code);
	if (!total) {
		total = {
			cells: 0,
			...(Object.fromEntries(
				pollutants.map((pollutant) => [
					pollutant,
					{ sum: 0, cells: 0 },
				]),
			) as Record<Pollutant, { sum: number; cells: number }>),
		};
		totals.set(code, total);
	}
	return total;
};
for (const [gridcode, code] of areaOf) if (code) totalFor(code).cells += 1;
for (const pollutant of pollutants)
	for (const { gridcode, value } of maps[pollutant].cells) {
		const code = areaOf.get(gridcode);
		if (!code) continue;
		const total = totalFor(code)[pollutant];
		total.sum += value;
		total.cells += 1;
	}

const round = (value: number) => value.toFixed(2);
const lines = ["ladCode,ladName,gridCells,no2Mean,pm10Mean,pm25Mean"];
for (const code of [...names.keys()].sort()) {
	const total = totals.get(code);
	const name = `"${names.get(code)!.replace(/"/g, '""')}"`;
	lines.push(
		[
			code,
			name,
			total?.cells ?? 0,
			...pollutants.map((pollutant) => {
				const measured = total?.[pollutant];
				return measured?.cells
					? round(measured.sum / measured.cells)
					: "";
			}),
		].join(","),
	);
}
writeFileSync(join(DIRECTORY, OUTPUT), `${lines.join("\n")}\n`);

const unassigned = assigned.filter((code) => !code).length;
const empty = [...names.keys()].filter((code) => !totals.has(code));
console.log(
	`Wrote ${totals.size} of ${names.size} authorities from ${gridcodes.length - unassigned} of ${gridcodes.length} cells; ${unassigned} cell centres fell in no authority${empty.length ? `; no cell centre in ${empty.join(", ")}` : ""}.`,
);
