/**
 * One-off fix: the published SG_DataZone_Bdry_2011 shapefile is in British
 * National Grid (EPSG:27700, see shapefile/SG_DataZone_Bdry_2011.prj), but
 * the GeoJSON converted from it (outside this repo, which has no shapefile
 * reader) was never reprojected to WGS84. Every other boundary release in
 * the catalog is WGS84, and the compile pipeline assumes that, so the data
 * zone layer was rendering at meaningless coordinates on the map.
 *
 * The reprojected GeoJSON is ~80MB, too large to check in, so only the
 * compiled result is kept (data/boundaries/data-zone/2011-12-sc-bfc/
 * boundaries.topojson, read directly by compile-boundaries.mts, the same
 * as superOutputArea/2011-ni). To reproduce or update it:
 *   1. Convert the shapefile to source.geojson (outside this repo).
 *   2. npx tsx scripts/reproject-datazone-boundary.mts
 *   3. pnpm boundaries:compile
 *   4. cp public/data/boundaries/data-zone/2011-12-sc-bfc/boundaries.topojson \
 *        data/boundaries/data-zone/2011-12-sc-bfc/boundaries.topojson
 */
import { readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import proj4 from "proj4";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SOURCE_PATH = join(
	ROOT,
	"data/boundaries/data-zone/2011-12-sc-bfc/source.geojson",
);

// EPSG:27700 (OSGB36 / British National Grid), matching the shapefile's .prj.
const BNG =
	"+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 " +
	"+ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 " +
	"+units=m +no_defs";
const WGS84 = "+proj=longlat +datum=WGS84 +no_defs";

const transform = proj4(BNG, WGS84);

// 7 decimal places is ~1cm at this latitude, far finer than the source
// shapefile's own precision; keeps the reprojected file close to the
// original size instead of ballooning with full float64 noise.
const round = (n: number) => Math.round(n * 1e7) / 1e7;

const reprojectCoordinates = (coordinates: unknown): unknown => {
	if (
		Array.isArray(coordinates) &&
		coordinates.length >= 2 &&
		typeof coordinates[0] === "number" &&
		typeof coordinates[1] === "number"
	) {
		const [x, y] = transform.forward([
			coordinates[0] as number,
			coordinates[1] as number,
		]);
		return [round(x), round(y)];
	}
	if (Array.isArray(coordinates)) return coordinates.map(reprojectCoordinates);
	throw new Error("Unexpected coordinate shape");
};

async function main() {
	const raw = JSON.parse(await readFile(SOURCE_PATH, "utf8")) as {
		type: string;
		features: {
			type: string;
			properties: Record<string, unknown>;
			geometry: { type: string; coordinates: unknown };
		}[];
	};

	const reprojected = {
		...raw,
		features: raw.features.map((f) => ({
			...f,
			geometry: {
				...f.geometry,
				coordinates: reprojectCoordinates(f.geometry.coordinates),
			},
		})),
	};

	await writeFile(SOURCE_PATH, JSON.stringify(reprojected));
	console.log(
		`Reprojected ${reprojected.features.length} data zone features from EPSG:27700 to WGS84.`,
	);
}

main();
