// Orchestrates the gazetteer core build from boundary topojson. Called from
// scripts/precompile-data.ts. Crosswalk shards are built separately
// (scripts/gazetteer-crosswalks.ts) since they are expensive and change rarely.
import { feature } from "topojson-client";
import { getProp } from "../boundaries/boundaries";
import { BOUNDARY_CATALOG } from "../boundaries/catalog";
import { localDataPath } from "../boundaries/dataPath";
import { LOCATIONS } from "../locations";
import { buildCore, linkRegions, type LevelSource } from "./build";
import { validateCore } from "./validate";
import type { GazetteerCore } from "./types";

export const GAZETTEER_VERSION = 1;

// The 9 English regions (ONS E12 codes) mapped to their LOCATIONS key. Members
// come from LOCATIONS; entries are synthesised in linkRegions. Nations
// (Scotland/Wales/NI) are a follow-up.
const REGIONS: Array<{ code: string; locationName: string }> = [
	{ code: "E12000001", locationName: "North East" },
	{ code: "E12000002", locationName: "North West" },
	{ code: "E12000003", locationName: "Yorkshire" },
	{ code: "E12000004", locationName: "East Midlands" },
	{ code: "E12000005", locationName: "West Midlands" },
	{ code: "E12000006", locationName: "East of England" },
	{ code: "E12000007", locationName: "London" },
	{ code: "E12000008", locationName: "South East" },
	{ code: "E12000009", locationName: "South West" },
];

type Feat = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>;

async function loadFeatures(
	read: (path: string) => Promise<string>,
	path: string,
): Promise<Feat[]> {
	const topo = JSON.parse(await read(localDataPath(path))) as {
		objects: Record<string, unknown>;
	};
	const name = Object.keys(topo.objects)[0];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const fc = feature(
		topo as any,
		topo.objects[name] as any,
	) as unknown as GeoJSON.FeatureCollection;
	return fc.features as Feat[];
}

export async function loadGazetteerCore(
	read: (path: string) => Promise<string>,
): Promise<GazetteerCore> {
	// Include multiple LAD vintages (oldest first) so codes referenced by
	// LOCATIONS that belong to reorganised/abolished councils still resolve;
	// current codes end up at their newest vintage as newer sources overwrite.
	const LAD_VINTAGES = [2016, 2023, 2024, 2025] as const;

	const ladByVintage = await Promise.all(
		LAD_VINTAGES.map((v) =>
			loadFeatures(read, BOUNDARY_CATALOG.localAuthority.vintages[v]),
		),
	);
	const con = await loadFeatures(
		read,
		BOUNDARY_CATALOG.constituency.vintages[2024],
	);

	const sources: LevelSource[] = [
		...LAD_VINTAGES.map((vintage, i) => ({
			level: "localAuthority" as const,
			vintage,
			features: ladByVintage[i],
			codeKeys: BOUNDARY_CATALOG.localAuthority.properties.code,
			nameKeys: BOUNDARY_CATALOG.localAuthority.properties.name,
		})),
		{
			level: "constituency",
			vintage: 2024,
			features: con,
			codeKeys: BOUNDARY_CATALOG.constituency.properties.code,
			nameKeys: BOUNDARY_CATALOG.constituency.properties.name,
		},
	];

	const core = buildCore(sources, LOCATIONS, GAZETTEER_VERSION);

	// Current LAD codes = union of post-reorganisation vintages (>= 2023). Region
	// area is rolled up over these only, so multi-vintage member lists don't
	// double-count areas reorganised by April 2023 (Cumbria, North Yorkshire).
	// Using a union (not a single file) is robust to gaps in any one vintage's
	// boundary file (e.g. the 2025 file is missing Barnsley/Sheffield).
	const currentCodes = new Set<string>();
	LAD_VINTAGES.forEach((v, i) => {
		if (v < 2023) return;
		for (const f of ladByVintage[i]) {
			const c = getProp(
				f.properties,
				BOUNDARY_CATALOG.localAuthority.properties.code,
			);
			if (c) currentCodes.add(c);
		}
	});

	// Backfill LAD -> region hierarchy from LOCATIONS region membership.
	linkRegions(
		core,
		REGIONS.flatMap((r) => {
			const loc = LOCATIONS[r.locationName];
			return loc
				? [
						{
							code: r.code,
							name: r.locationName,
							memberCodes: loc.lad_codes,
						},
					]
				: [];
		}),
		currentCodes,
	);

	const { errors, warnings } = validateCore(core, LOCATIONS);
	if (warnings.length > 0)
		console.warn(
			`  gazetteer: ${warnings.length} warning(s) (LOCATIONS curation debt), e.g. ${warnings[0]}`,
		);
	if (errors.length > 0) {
		throw new Error(
			`gazetteer core validation failed (${errors.length}):\n  ` +
				errors.slice(0, 10).join("\n  "),
		);
	}

	return core;
}
