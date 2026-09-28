import { withCDN } from "../../helpers/cdn";
import {
	parsePrecompiledBoundaryMappings,
	type CodeMapping,
	type CodeType,
	type PrecompiledBoundaryMappings,
	type YearCode,
} from "./mappings";

const BOUNDARY_MAPPINGS_URL = withCDN("/data/datasets/boundary-mappings.json");

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
				parsePrecompiledBoundaryMappings(await response.json()),
				target,
			);
			return true;
		})
		.catch((error) => {
			// The file ships with the code (its URL carries the deploy's data
			// version), so this is a failed fetch; the next load retries.
			console.warn(
				"[boundaries] Boundary mappings unavailable; area filters will be incomplete:",
				error,
			);
			seededMappers.delete(target);
			return false;
		});
	seededMappers.set(target, seeding);
	return seeding;
};
