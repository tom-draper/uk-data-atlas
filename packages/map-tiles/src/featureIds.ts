/**
 * A map resource numbers its areas so a renderer can hold state against them,
 * because a vector tile feature id must be an integer. The number is the
 * code's place in sorted order, which anything holding the same set of codes
 * can reproduce without reading the tiles.
 */
export const featureIds = (codes: string[]) =>
	new Map([...codes].sort().map((code, index) => [code, index + 1] as const));
