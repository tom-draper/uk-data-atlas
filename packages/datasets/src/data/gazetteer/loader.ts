// Orchestrates the gazetteer core build from boundary topojson. Called from
// scripts/precompile-data.ts. Crosswalk shards are built separately
// (scripts/gazetteer-crosswalks.ts) since they are expensive and change rarely.
import { feature } from "topojson-client";
import { getProp } from "../boundaries/properties";
import { BOUNDARY_CATALOG } from "../boundaries/catalog";
import { localDataPath } from "../boundaries/dataPath";
import { LOCATIONS } from "../locations";
import { buildCore, type LevelSource } from "./build";
import { bboxOf, centroidOf, outerRings, pointInGeom } from "./geometry";
import { validateCore } from "./validate";
import {
	OFFICIAL_PLACES,
	PLACE_LOOKUPS,
	resolvePlaces,
	type ResolvedPlace,
} from "./places";
import type { GazetteerCore } from "./types";
import type { Topology } from "topojson-specification";

export const GAZETTEER_VERSION = 1;

type Feat = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>;

type Region = {
	code: string;
	name: string;
	geometry: GeoJSON.Geometry;
};

/**
 * Assign every English LAD to its ONS region using the boundary geometry,
 * rather than a hand-maintained subset of named-location members. The latter
 * omitted East Midlands entirely and left records out of the region chunks.
 */
function linkLadsToRegions(
	core: GazetteerCore,
	localAuthorityFeatures: Feat[],
	regionFeatures: Feat[],
	currentCodes: Set<string>,
): void {
	const regions = regionFeatures.flatMap((feature) => {
		const code = getProp(
			feature.properties,
			BOUNDARY_CATALOG.region.properties.code,
		);
		const name = getProp(
			feature.properties,
			BOUNDARY_CATALOG.region.properties.name,
		);
		return code && name ? [{ code, name, geometry: feature.geometry }] : [];
	}) as Region[];
	const regionForPoint = (lng: number, lat: number) =>
		regions.find(({ geometry }) => pointInGeom(lng, lat, geometry));
	const regionForGeometry = (geometry: GeoJSON.Geometry) => {
		const fromCentroid = regionForPoint(...centroidOf(geometry));
		if (fromCentroid) return fromCentroid;
		// The compiled TopoJSON keeps only code/name properties, so the ONS
		// representative point is unavailable here. A coastal area's vertex
		// centroid can fall in the sea (Torbay); fall back to an interior vertex.
		for (const ring of outerRings(geometry))
			for (const [lng, lat] of ring) {
				const region = regionForPoint(lng, lat);
				if (region) return region;
			}
		return undefined;
	};

	for (const feature of localAuthorityFeatures) {
		const code = getProp(
			feature.properties,
			BOUNDARY_CATALOG.localAuthority.properties.code,
		);
		if (!code?.startsWith("E")) continue;
		const entry = core.byCode[code];
		if (!entry) continue;
		const region = regionForGeometry(feature.geometry);
		if (region) entry.parents = [region.code];
	}

	for (const region of regions) {
		const members = Object.values(core.byCode).filter(
			(entry) =>
				entry.level === "localAuthority" &&
				currentCodes.has(entry.code) &&
				entry.parents[0] === region.code,
		);
		if (members.length === 0) continue;
		core.byCode[region.code] = {
			code: region.code,
			name: region.name,
			level: "region",
			vintage: 2025,
			areaM2: members.reduce((sum, entry) => sum + entry.areaM2, 0),
			bbox: bboxOf(region.geometry).map((n) => +n.toFixed(4)) as [
				number,
				number,
				number,
				number,
			],
			parents: [],
		};
		const nameIndex = (core.nameIndex[region.name.toLowerCase()] ??= []);
		if (!nameIndex.includes(region.code)) nameIndex.push(region.code);
	}
}

/** Each ONS place code's local authorities, from the lookups in data/. */
async function loadPlaceMembers(
	read: (path: string) => Promise<string>,
): Promise<Record<string, string[]>> {
	const members: Record<string, string[]> = {};
	for (const { lookup, file, localAuthorityKey, placeKey } of PLACE_LOOKUPS) {
		const { features } = JSON.parse(
			await read(`lookups/${lookup}/${file}`),
		) as { features: { properties: Record<string, unknown> }[] };
		for (const { properties } of features) {
			const place = properties[placeKey];
			const localAuthority = properties[localAuthorityKey];
			if (typeof place === "string" && typeof localAuthority === "string")
				(members[place] ??= []).push(localAuthority);
		}
	}
	return members;
}

/** Say what the lookups changed, so a drifting curated list is visible. */
function reportPlaceChanges(
	places: Record<string, ResolvedPlace>,
	currentCodes: ReadonlySet<string>,
) {
	for (const [name, place] of Object.entries(places)) {
		if (!place.source) continue;
		const curated = new Set(
			(LOCATIONS[name]?.lad_codes ?? []).filter((c) =>
				currentCodes.has(c),
			),
		);
		const sourced = place.lad_codes.filter((c) => currentCodes.has(c));
		const added = sourced.filter((c) => !curated.has(c));
		const removed = [...curated].filter((c) => !sourced.includes(c));
		if (added.length || removed.length)
			console.log(
				`  gazetteer: ${name} (from ${place.source.lookup}` +
					(added.length ? `; adds ${added.join(" ")}` : "") +
					(removed.length ? `; drops ${removed.join(" ")}` : "") +
					")",
			);
	}
}

async function loadFeatures(
	read: (path: string) => Promise<string>,
	path: string,
): Promise<Feat[]> {
	const topo = JSON.parse(await read(localDataPath(path))) as Topology;
	const name = Object.keys(topo.objects)[0];
	// A boundary file's object is a GeometryCollection, so this is a collection
	// of features; guard rather than assume, since the type allows both.
	const result = feature(topo, topo.objects[name]);
	const features = result.type === "Feature" ? [result] : result.features;
	return features as Feat[];
}

export async function loadGazetteerCore(
	read: (path: string) => Promise<string>,
): Promise<GazetteerCore> {
	// Every LAD vintage with GSS codes (2011 on), oldest first, so a code any
	// shipped release uses resolves, including those LOCATIONS keeps for
	// reorganised or recoded councils (Gateshead's 2013 recode, Somerset West
	// and Taunton); current codes end up at their newest vintage as newer
	// sources overwrite. Earlier releases use old ONS codes no place names.
	const LAD_VINTAGES = Object.keys(BOUNDARY_CATALOG.localAuthority.vintages)
		.map(Number)
		.filter((vintage) => vintage >= 2011)
		.sort((a, b) => a - b);

	const ladByVintage = await Promise.all(
		LAD_VINTAGES.map((v) =>
			loadFeatures(read, BOUNDARY_CATALOG.localAuthority.vintages[v]),
		),
	);
	const con = await loadFeatures(
		read,
		BOUNDARY_CATALOG.constituency.vintages[2024],
	);
	const regions = await loadFeatures(
		read,
		BOUNDARY_CATALOG.region.vintages[2025],
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

	const placeMembers = await loadPlaceMembers(read);
	const lookupCodes = new Set(Object.values(placeMembers).flat());
	const places = resolvePlaces(
		LOCATIONS,
		OFFICIAL_PLACES,
		placeMembers,
		lookupCodes,
	);
	reportPlaceChanges(places, lookupCodes);
	const core = buildCore(sources, places, GAZETTEER_VERSION);

	linkLadsToRegions(core, ladByVintage.flat(), regions, currentCodes);

	const { errors, warnings } = validateCore(core, places, currentCodes);
	if (warnings.length > 0)
		console.warn(
			`  gazetteer: ${warnings.length} warning(s) (LOCATIONS codes to check), e.g. ${warnings[0]}`,
		);
	if (errors.length > 0) {
		throw new Error(
			`gazetteer core validation failed (${errors.length}):\n  ` +
				errors.slice(0, 10).join("\n  "),
		);
	}

	return core;
}
