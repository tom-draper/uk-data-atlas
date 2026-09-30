import type { AreaLineage } from "./areaLineage";
import { withCDN } from "../../helpers/cdn";
import { LINEAGE_TYPES, type LineageType } from "./codeMapper";
import {
	parsePrecompiledBoundaryMappings,
	type PrecompiledBoundaryMappings,
	type YearCode,
} from "./mappings";

const BOUNDARY_MAPPINGS_URL = withCDN("/data/datasets/boundary-mappings.json");
const AREA_LINEAGE_URL = withCDN("/data/datasets/area-lineage.json");

/** The mutable boundary-code lookup populated from precompiled mappings. */
export type BoundaryMappingTarget = {
	getLadForWard?: (wardCode: string) => string | undefined;
	addWardLadMappings?: (mappings: Record<string, string>) => void;
	addLadWardMappings?: (
		year: YearCode,
		mappings: Record<string, string[]>,
	) => void;
	addConstituencyWardMappings?: (
		year: YearCode,
		mappings: Record<string, string[]>,
	) => void;
	setAreaLineage?: (type: LineageType, lineage: AreaLineage) => void;
};

/** Load the API resolver's lineages, written by `pnpm lineage:build`. */
export const applyAreaLineage = (
	lineages: Partial<Record<LineageType, AreaLineage>>,
	target: BoundaryMappingTarget,
) => {
	for (const type of LINEAGE_TYPES) {
		const lineage = lineages[type];
		if (lineage) target.setAreaLineage?.(type, lineage);
	}
};

const fetchJson = async (url: string, what: string) => {
	const response = await fetch(url);
	if (!response.ok)
		throw new Error(
			`Failed to fetch ${what}: ${response.status} ${response.statusText}`,
		);
	return response.json();
};

export const applyBoundaryMappings = (
	mappings: PrecompiledBoundaryMappings,
	target: BoundaryMappingTarget,
) => {
	target.addWardLadMappings?.(mappings.wardToLad);
	for (const [year, ladMappings] of Object.entries(mappings.ladToWards))
		target.addLadWardMappings?.(Number(year), ladMappings);
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

	const seeding = Promise.all([
		fetchJson(BOUNDARY_MAPPINGS_URL, "boundary mappings"),
		fetchJson(AREA_LINEAGE_URL, "area lineage"),
	])
		.then(([mappings, lineages]) => {
			applyBoundaryMappings(
				parsePrecompiledBoundaryMappings(mappings),
				target,
			);
			applyAreaLineage(lineages, target);
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
