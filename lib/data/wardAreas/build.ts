// Precompiles per-ward land area (km²) so population density can be computed from
// a code lookup instead of expanding ward polygons at runtime. Uses the exact same
// polygonAreaSqKm over the same TopoJSON as the old runtime path, so densities are
// identical. Only the population vintage (ward 2023) is emitted — the only consumer.
import { feature } from "topojson-client";
import { GEOJSON_PATHS, PROPERTY_KEYS, getProp } from "../boundaries/boundaries";
import { polygonAreaSqKm } from "../../helpers/population";

// Ward vintage the population dataset is keyed to (population loader boundaryYear).
const WARD_AREA_VINTAGE = 2023;

const rel = (p: string) => p.slice(p.indexOf("/data/") + "/data/".length);

export async function buildWardAreas(
	read: (path: string) => Promise<string>,
): Promise<Record<string, number>> {
	const path = (GEOJSON_PATHS.ward as Record<number, string>)[WARD_AREA_VINTAGE];
	const topo = JSON.parse(await read(rel(path))) as {
		objects: Record<string, unknown>;
	};
	const name = Object.keys(topo.objects)[0];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const fc = feature(topo as any, topo.objects[name] as any) as unknown as {
		features: GeoJSON.Feature[];
	};

	const areas: Record<string, number> = {};
	for (const f of fc.features) {
		const code = getProp(
			f.properties as Record<string, unknown>,
			PROPERTY_KEYS.wardCode,
		);
		if (!code || !f.geometry || !("coordinates" in f.geometry)) continue;
		areas[code] = polygonAreaSqKm(
			f.geometry.coordinates as number[][][] | number[][][][],
		);
	}
	return areas;
}
