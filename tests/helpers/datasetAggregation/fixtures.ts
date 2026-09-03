import type { Features, PropertyKeys } from "@/lib/types";

/** The boundary property key the reducers are pointed at in these tests. */
export const CODE_KEY = "LAD24CD" as PropertyKeys;

/** Too few points to enclose anything, which the area helper scores as zero. */
const DEGENERATE_RING: number[][][] = [
	[
		[0, 0],
		[0, 0],
		[0, 0],
	],
];

/**
 * Boundary features carrying only an area code, plus optional shared geometry
 * for the reducers that measure land area. The default ring is degenerate, so
 * those boundaries contribute no area.
 */
export const features = (
	codes: string[],
	coordinates: number[][][] = DEGENERATE_RING,
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
