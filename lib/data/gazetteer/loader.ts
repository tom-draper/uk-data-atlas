// Orchestrates the gazetteer core build from boundary topojson. Called from
// scripts/precompile-data.ts. Crosswalk shards are built separately
// (scripts/gazetteer-crosswalks.ts) since they are expensive and change rarely.
import { feature } from "topojson-client";
import { GEOJSON_PATHS, PROPERTY_KEYS } from "../boundaries/boundaries";
import { LOCATIONS } from "../locations";
import { buildCore, type LevelSource } from "./build";
import { validateCore } from "./validate";
import type { GazetteerCore } from "./types";

export const GAZETTEER_VERSION = 1;

type Feat = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>;

// GEOJSON_PATHS values look like "/data/boundaries/..."; strip to the path
// relative to public/data that the precompile `read` expects.
const relPath = (p: string) => p.slice(p.indexOf("/data/") + "/data/".length);

async function loadFeatures(read: (path: string) => Promise<string>, path: string): Promise<Feat[]> {
	const topo = JSON.parse(await read(relPath(path))) as { objects: Record<string, unknown> };
	const name = Object.keys(topo.objects)[0];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const fc = feature(topo as any, topo.objects[name] as any) as unknown as GeoJSON.FeatureCollection;
	return fc.features as Feat[];
}

export async function loadGazetteerCore(
	read: (path: string) => Promise<string>,
): Promise<GazetteerCore> {
	const paths = GEOJSON_PATHS as Record<string, Record<number, string>>;

	// Include multiple LAD vintages (oldest first) so codes referenced by
	// LOCATIONS that belong to reorganised/abolished councils still resolve;
	// current codes end up at their newest vintage as newer sources overwrite.
	const LAD_VINTAGES = [2016, 2023, 2024, 2025];

	const ladByVintage = await Promise.all(
		LAD_VINTAGES.map((v) => loadFeatures(read, paths.localAuthority[v])),
	);
	const con = await loadFeatures(read, paths.constituency[2024]);

	const sources: LevelSource[] = [
		...LAD_VINTAGES.map((vintage, i) => ({
			level: "localAuthority" as const,
			vintage,
			features: ladByVintage[i],
			codeKeys: PROPERTY_KEYS.ladCode,
			nameKeys: PROPERTY_KEYS.ladName,
		})),
		{
			level: "constituency",
			vintage: 2024,
			features: con,
			codeKeys: PROPERTY_KEYS.constituencyCode,
			nameKeys: PROPERTY_KEYS.constituencyName,
		},
	];

	const core = buildCore(sources, LOCATIONS, GAZETTEER_VERSION);

	const { errors, warnings } = validateCore(core, LOCATIONS);
	if (warnings.length > 0)
		console.warn(`  gazetteer: ${warnings.length} warning(s) (LOCATIONS curation debt), e.g. ${warnings[0]}`);
	if (errors.length > 0) {
		throw new Error(
			`gazetteer core validation failed (${errors.length}):\n  ` +
				errors.slice(0, 10).join("\n  "),
		);
	}

	return core;
}
