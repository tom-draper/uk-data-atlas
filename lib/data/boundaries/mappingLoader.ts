import { feature } from "topojson-client";
import type { BoundaryGeojson } from "@lib/types";
import { GEOJSON_PATHS, type BoundaryType, PROPERTY_KEYS } from "./boundaries";
import { localDataPath } from "./dataPath";
import {
	buildConstituencyWardMappings,
	buildCrossYearMappings,
	extractWardLadMappings,
	type PrecompiledBoundaryMappings,
} from "./mappings";

type BoundaryGroup = Record<number, BoundaryGeojson>;

async function loadBoundaryFile(
	read: (path: string) => Promise<string>,
	path: string,
): Promise<BoundaryGeojson> {
	const topology = JSON.parse(await read(localDataPath(path))) as {
		objects: Record<string, unknown>;
	};
	const objectName = Object.keys(topology.objects)[0];
	const result = feature(
		topology as never,
		topology.objects[objectName] as never,
	) as unknown;

	return result as BoundaryGeojson;
}

async function loadBoundaryGroup(
	read: (path: string) => Promise<string>,
	type: Extract<BoundaryType, "ward" | "constituency" | "localAuthority">,
): Promise<BoundaryGroup> {
	const paths = GEOJSON_PATHS[type];
	const entries = await Promise.all(
		Object.entries(paths).map(
			async ([year, path]) =>
				[Number(year), await loadBoundaryFile(read, path)] as const,
		),
	);
	return Object.fromEntries(entries);
}

export async function loadBoundaryMappings(
	read: (path: string) => Promise<string>,
): Promise<PrecompiledBoundaryMappings> {
	const [wards, constituencies, localAuthorities] = await Promise.all([
		loadBoundaryGroup(read, "ward"),
		loadBoundaryGroup(read, "constituency"),
		loadBoundaryGroup(read, "localAuthority"),
	]);

	const wardToLad: Record<string, string> = {};
	const ladToWards: Record<number, Record<string, string[]>> = {};
	for (const [year, boundary] of Object.entries(wards)) {
		const mappings = extractWardLadMappings(
			boundary.features,
			PROPERTY_KEYS.wardCode,
			PROPERTY_KEYS.ladCode,
		);
		Object.assign(wardToLad, mappings.wardToLad);
		if (Object.keys(mappings.ladToWards).length > 0) {
			ladToWards[Number(year)] = mappings.ladToWards;
		}
	}

	const latestWardYear = Math.max(...Object.keys(wards).map(Number));
	const constituencyToWards: Record<number, Record<string, string[]>> = {};
	const constituencyWardMappings: Record<string, string[]> = {};
	for (const boundary of Object.values(constituencies)) {
		Object.assign(
			constituencyWardMappings,
			buildConstituencyWardMappings(wards[latestWardYear], boundary),
		);
	}
	constituencyToWards[latestWardYear] = constituencyWardMappings;

	return {
		version: 1,
		wardToLad,
		ladToWards,
		codeMappings: {
			ward: buildCrossYearMappings(
				wards,
				"ward",
				Object.keys(wards).map(Number),
			),
			constituency: buildCrossYearMappings(
				constituencies,
				"constituency",
				Object.keys(constituencies).map(Number),
			),
			localAuthority: buildCrossYearMappings(
				localAuthorities,
				"localAuthority",
				Object.keys(localAuthorities).map(Number),
			),
		},
		constituencyToWards,
	};
}
