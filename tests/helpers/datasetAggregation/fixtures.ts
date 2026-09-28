import type { Features, PropertyKeys } from "@/lib/types";

/** The boundary property key the reducers are pointed at in these tests. */
export const CODE_KEY = "LAD24CD" as PropertyKeys;

/**
 * Boundary features carrying only an area code, plus optional shared geometry
 * for the reducers that measure land area. Boundaries default to no
 * geometry at all, so they contribute no area.
 */
export const features = (
	codes: string[],
	coordinates: number[][][] = [],
): Features =>
	codes.map((code) => ({
		type: "Feature",
		properties: { [CODE_KEY]: code },
		geometry: { type: "Polygon", coordinates },
	})) as unknown as Features;

/** A closed square ring, one degree on each side, near the centre of England. */
export const SQUARE: number[][][] = [
	[
		[-1, 52],
		[0, 52],
		[0, 53],
		[-1, 53],
		[-1, 52],
	],
];
