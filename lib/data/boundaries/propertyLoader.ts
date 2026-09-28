import type { BoundaryData, BoundaryGeojson } from "@lib/types";
import { fetchBoundaryProperties } from "./boundaries";
import {
	BOUNDARY_CATALOG,
	BOUNDARY_TYPES,
	boundaryYears,
	type BoundaryType,
} from "./catalog";

export const EMPTY_BOUNDARY_DATA: BoundaryData = Object.fromEntries(
	BOUNDARY_TYPES.map((type) => [
		type,
		Object.fromEntries(boundaryYears(type).map((year) => [year, null])),
	]),
) as BoundaryData;

export type BoundaryGroupLoad = {
	data: Record<number, BoundaryGeojson>;
	/** One message per vintage that could not be fetched. */
	failures: string[];
};

type PropertiesFetcher = (path: string) => Promise<BoundaryGeojson>;

/**
 * Fetch every vintage of a geography as properties rather than geometry.
 *
 * Charts aggregate over codes and attributes, not coordinates. Geometry for
 * the one vintage being drawn is fetched separately by the map, avoiding the
 * cost of retaining every boundary release in memory.
 */
export const fetchBoundaryPropertyGroup = async (
	type: BoundaryType,
	fetchProperties: PropertiesFetcher = fetchBoundaryProperties,
): Promise<BoundaryGroupLoad> => {
	const paths = BOUNDARY_CATALOG[type].propertyVintages;
	const years = Object.keys(paths).map(Number);
	const settled = await Promise.allSettled(
		years.map(async (year) => {
			const path = paths[year as keyof typeof paths];
			return [year, await fetchProperties(path)] as const;
		}),
	);
	const data = Object.fromEntries(
		settled
			.filter(
				(
					r,
				): r is PromiseFulfilledResult<
					readonly [number, BoundaryGeojson]
				> => r.status === "fulfilled",
			)
			.map((r) => r.value),
	);
	const failures: string[] = [];
	settled.forEach((result, index) => {
		if (result.status !== "rejected") return;
		const message = `Could not load ${type} boundaries for ${years[index]}: ${
			result.reason instanceof Error
				? result.reason.message
				: String(result.reason)
		}`;
		console.error(`[boundaries] ${message}`);
		failures.push(message);
	});

	return { data, failures };
};
