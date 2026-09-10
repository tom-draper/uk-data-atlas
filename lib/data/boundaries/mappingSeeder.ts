import type { BoundaryGeojson } from "@lib/types";
import { withCDN } from "../../helpers/cdn";
import { BOUNDARY_CATALOG, type BoundaryType } from "./catalog";
import {
	buildConstituencyWardMappings,
	buildCrossYearMappings,
	extractWardLadMappings,
	type CodeMapping,
	type CodeType,
	type PrecompiledBoundaryMappings,
	type YearCode,
} from "./mappings";

const BOUNDARY_MAPPINGS_URL = withCDN(
	"/data/precompiled/boundary-mappings.json",
);

/** The mutable boundary-code lookup populated from precompiled mappings. */
export type BoundaryMappingTarget = {
	getLadForWard?: (wardCode: string) => string | undefined;
	addWardLadMappings?: (mappings: Record<string, string>) => void;
	addLadWardMappings?: (
		year: YearCode,
		mappings: Record<string, string[]>,
	) => void;
	addCodeMappings?: (type: CodeType, mappings: CodeMapping) => void;
	addConstituencyWardMappings?: (
		year: YearCode,
		mappings: Record<string, string[]>,
	) => void;
};

export const applyBoundaryMappings = (
	mappings: PrecompiledBoundaryMappings,
	target: BoundaryMappingTarget,
) => {
	target.addWardLadMappings?.(mappings.wardToLad);
	for (const [year, ladMappings] of Object.entries(mappings.ladToWards))
		target.addLadWardMappings?.(Number(year), ladMappings);
	target.addCodeMappings?.("ward", mappings.codeMappings.ward);
	target.addCodeMappings?.(
		"constituency",
		mappings.codeMappings.constituency,
	);
	target.addCodeMappings?.(
		"localAuthority",
		mappings.codeMappings.localAuthority,
	);
	for (const [year, constituencyMappings] of Object.entries(
		mappings.constituencyToWards,
	))
		target.addConstituencyWardMappings?.(
			Number(year),
			constituencyMappings,
		);
};

const seededMappers = new WeakMap<BoundaryMappingTarget, Promise<boolean>>();

/** Load the precompiled mappings once per mapper. */
export const seedBoundaryMappings = (
	target: BoundaryMappingTarget,
): Promise<boolean> => {
	const seeded = seededMappers.get(target);
	if (seeded) return seeded;

	const seeding = fetch(BOUNDARY_MAPPINGS_URL)
		.then(async (response) => {
			if (!response.ok)
				throw new Error(
					`Failed to fetch boundary mappings: ${response.status} ${response.statusText}`,
				);
			applyBoundaryMappings(
				(await response.json()) as PrecompiledBoundaryMappings,
				target,
			);
			return true;
		})
		.catch((error) => {
			console.warn(
				"[boundaries] Falling back to in-browser mapping generation:",
				error,
			);
			seededMappers.delete(target);
			return false;
		});
	seededMappers.set(target, seeding);
	return seeding;
};

type FetchedMappings = Partial<
	Record<BoundaryType, Record<number, BoundaryGeojson>>
>;

/**
 * Compatibility path for a CDN revision without the precompiled mapping file.
 * It deliberately only derives mappings when the three required geographies
 * were fetched together; constituency-to-ward matching needs geometry and is
 * unavailable from the properties sidecars.
 */
export const deriveBoundaryMappings = (
	fetched: FetchedMappings,
	target: BoundaryMappingTarget,
) => {
	if (!fetched.ward || !fetched.constituency || !fetched.localAuthority)
		return;

	const wardToLad: Record<string, string> = {};
	for (const [year, boundary] of Object.entries(fetched.ward)) {
		const wardMappings = extractWardLadMappings(
			boundary.features,
			BOUNDARY_CATALOG.ward.properties.code,
			BOUNDARY_CATALOG.ward.properties.parentCode ??
				BOUNDARY_CATALOG.localAuthority.properties.code,
		);
		Object.assign(wardToLad, wardMappings.wardToLad);
		target.addLadWardMappings?.(Number(year), wardMappings.ladToWards);
	}
	target.addWardLadMappings?.(wardToLad);
	for (const type of ["ward", "constituency", "localAuthority"] as const) {
		const boundaries = fetched[type]!;
		target.addCodeMappings?.(
			type,
			buildCrossYearMappings(
				boundaries,
				type,
				Object.keys(boundaries).map(Number),
			),
		);
	}

	const wardGroup = fetched.ward;
	const latestWardYear = Math.max(
		...Object.keys(wardGroup)
			.map(Number)
			.filter((year) => wardGroup[year]?.features),
	);
	const latestWardData = wardGroup[latestWardYear];
	if (!latestWardData?.features) return;
	const mergedMappings: Record<string, string[]> = {};
	for (const constituencyData of Object.values(fetched.constituency)) {
		if (!constituencyData?.features) continue;
		Object.assign(
			mergedMappings,
			buildConstituencyWardMappings(latestWardData, constituencyData),
		);
	}
	if (Object.keys(mergedMappings).length > 0)
		target.addConstituencyWardMappings?.(latestWardYear, mergedMappings);
};
