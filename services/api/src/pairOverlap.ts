import polygonClipping from "polygon-clipping";
import { boundsIntersect, boundsOf, toPolygons } from "./areaGeometryPieces";
import { multiPolygonAreaM2, polygonWidthM } from "./equalAreaProjection";
import { CLIPPING_VERSION } from "./pieceIntersection";

/**
 * The thresholds the published area-overlap crosswalks are compiled with, and
 * the tools behind them, stated with every pairwise answer.
 */
export const PAIR_OVERLAP_RULES = {
	sliverWidthM: 100,
	minimumCoverage: 0.99,
	areaProjection: "EPSG:6933",
	clipping: `polygon-clipping@${CLIPPING_VERSION}`,
} as const;

export type PairRelation =
	| "disjoint"
	| "boundary-only"
	| "overlaps"
	| "within"
	| "contains"
	| "same-extent"
	| "indeterminate";

export type PairOverlap = {
	relation: PairRelation;
	firstAreaM2: number;
	secondAreaM2: number;
	overlapAreaM2: number;
	/** Overlap as a share of the first area. */
	shareOfFirst: number;
	/** Overlap as a share of the second area. */
	shareOfSecond: number;
	pieceCount: number;
	/** The width of the widest intersection piece, or null with none. */
	widestPieceWidthM: number | null;
};

/**
 * Measure how two areas overlap, under the rules the published area-overlap
 * crosswalks are compiled with, so this answer and a crosswalk's cannot
 * disagree about the same pair.
 *
 * Independently generalised boundaries leave slivers where they should meet,
 * so an intersection is judged by its widest piece: under `sliverWidthM` it is
 * border noise, not overlap. A piece within a factor of two of that threshold
 * is where a crosswalk compile refuses to decide, and so is `indeterminate`
 * here. Otherwise an area is within the other once `minimumCoverage` of it is
 * covered, which absorbs the same noise along the rest of its border.
 */
export const measurePairOverlap = (
	first: unknown,
	second: unknown,
	{
		sliverWidthM,
		minimumCoverage,
	}: { sliverWidthM: number; minimumCoverage: number },
): PairOverlap => {
	const firstGeometry = toPolygons(first, "The first geometry");
	const secondGeometry = toPolygons(second, "The second geometry");
	const firstAreaM2 = multiPolygonAreaM2(firstGeometry);
	const secondAreaM2 = multiPolygonAreaM2(secondGeometry);
	const intersection = boundsIntersect(
		boundsOf(firstGeometry),
		boundsOf(secondGeometry),
	)
		? polygonClipping.intersection(firstGeometry, secondGeometry)
		: [];
	const overlapAreaM2 = multiPolygonAreaM2(intersection);
	const widestPieceWidthM =
		intersection.length > 0
			? Math.max(...intersection.map(polygonWidthM))
			: null;
	// An area wholly inside the other can measure a hair over its own area.
	const shareOf = (areaM2: number) =>
		areaM2 > 0 ? Math.min(1, overlapAreaM2 / areaM2) : 0;
	const shareOfFirst = shareOf(firstAreaM2);
	const shareOfSecond = shareOf(secondAreaM2);
	const relation = ((): PairRelation => {
		if (widestPieceWidthM === null || overlapAreaM2 <= 0) return "disjoint";
		if (
			widestPieceWidthM >= sliverWidthM / 2 &&
			widestPieceWidthM < sliverWidthM * 2
		)
			return "indeterminate";
		if (widestPieceWidthM < sliverWidthM) return "boundary-only";
		const firstCovered = shareOfFirst >= minimumCoverage;
		const secondCovered = shareOfSecond >= minimumCoverage;
		if (firstCovered && secondCovered) return "same-extent";
		if (firstCovered) return "within";
		if (secondCovered) return "contains";
		return "overlaps";
	})();
	return {
		relation,
		firstAreaM2,
		secondAreaM2,
		overlapAreaM2,
		shareOfFirst,
		shareOfSecond,
		pieceCount: intersection.length,
		widestPieceWidthM,
	};
};
