import type { BoundaryGeojson } from "@lib/types";
import type { BoundaryType } from "./boundaries";
import { BOUNDARY_CATALOG } from "./catalog";
import { localDataPath } from "./dataPath";
import { decodeBoundaryData } from "./decode";
import {
	buildConstituencyWardMappings,
	buildCrossYearMappings,
	extractWardLadMappings,
	type PrecompiledBoundaryMappings,
} from "./mappings";
import { wardLadFromGeometry } from "./wardLadGeometry";

type BoundaryGroup = Record<number, BoundaryGeojson>;

/**
 * How ward releases spell the local authority they name — `lad16cd` among
 * them, which the local authority family's own key list does not carry, since
 * it describes a different set of files. Reading a ward's parent with the
 * wrong list finds nothing and the release contributes no mapping at all.
 */
const WARD_PARENT_CODE_KEYS =
	BOUNDARY_CATALOG.ward.properties.parentCode ??
	BOUNDARY_CATALOG.localAuthority.properties.code;

async function loadBoundaryFile(
	read: (path: string) => Promise<string>,
	path: string,
): Promise<BoundaryGeojson> {
	return decodeBoundaryData(JSON.parse(await read(localDataPath(path))));
}

async function loadBoundaryGroup(
	read: (path: string) => Promise<string>,
	type: Extract<BoundaryType, "ward" | "constituency" | "localAuthority">,
): Promise<BoundaryGroup> {
	const paths = BOUNDARY_CATALOG[type].vintages;
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
			BOUNDARY_CATALOG.ward.properties.code,
			WARD_PARENT_CODE_KEYS,
		);
		Object.assign(wardToLad, mappings.wardToLad);
		if (Object.keys(mappings.ladToWards).length > 0) {
			ladToWards[Number(year)] = mappings.ladToWards;
		}
	}

	// ONS published no local authority for the December 2017 to 2021 wards, so
	// those releases contribute nothing above, and a ward one of them
	// introduced that was later abolished ends up in no mapping at all. That
	// ward is then dropped from every filtered view, because `filterFeatures`
	// keeps a ward only when its authority is one of the location's — which is
	// how a card keyed to an older release comes to draw nothing anywhere but
	// the whole United Kingdom, leaving whatever was on the map before it.
	//
	// Fill only the gaps, and fill them from the newest authorities, because
	// that is the vocabulary the gazetteer's locations mostly speak. A ward
	// that already names its own authority keeps it: that release said which
	// authority it meant, and some locations are still named by the codes of
	// the era those releases belong to.
	const newestLocalAuthorities =
		localAuthorities[
			Math.max(...Object.keys(localAuthorities).map(Number))
		];
	for (const boundary of Object.values(wards)) {
		Object.assign(
			wardToLad,
			wardLadFromGeometry(
				boundary.features,
				BOUNDARY_CATALOG.ward.properties.code,
				newestLocalAuthorities.features,
				BOUNDARY_CATALOG.localAuthority.properties.code,
				(wardCode) => !wardToLad[wardCode],
			),
		);
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
