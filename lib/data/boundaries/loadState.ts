import type { BoundaryData, BoundaryGeojson } from "@/lib/types";
import type { BoundaryType } from "./catalog";
import type { BoundaryGroupLoad } from "./propertyLoader";

export type BoundaryGroupResult = readonly [BoundaryType, BoundaryGroupLoad];

/** A geography is complete only when every requested vintage was available. */
export const completedBoundaryTypes = (
	groups: readonly BoundaryGroupResult[],
): BoundaryType[] =>
	groups
		.filter(([, { failures }]) => failures.length === 0)
		.map(([type]) => type);

/**
 * Add fetched property vintages without discarding prior successful loads.
 *
 * A partial retry should fill a previously failed vintage, not replace the
 * complete set with only whichever files happened to succeed this time.
 */
export const mergeBoundaryGroups = (
	previous: BoundaryData,
	groups: readonly BoundaryGroupResult[],
): BoundaryData => {
	const fetched = Object.fromEntries(
		groups.map(([type, { data }]) => [
			type,
			{ ...previous[type], ...(data as Record<number, BoundaryGeojson>) },
		]),
	) as Partial<BoundaryData>;
	return { ...previous, ...fetched };
};
