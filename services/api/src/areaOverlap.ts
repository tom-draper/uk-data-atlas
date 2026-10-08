import { createHash } from "node:crypto";
import polygonClipping from "polygon-clipping";
import type { GeometrySourceLookup } from "./areaGeometry";
import {
	boundsIntersect,
	boundsOf,
	candidatePieces,
	toPolygons,
	type AreaGeometry,
} from "./areaGeometryPieces";
import type { AreaLookup } from "./areaInventory";
import type { AreaOverlapCrosswalkAdapter } from "./crosswalkAdapters";
import type {
	AreaOverlapCrosswalkArtifact,
	AreaOverlapTarget,
} from "./crosswalkInventory";
import { validateEndpoint } from "./crosswalkValidation";
import { multiPolygonAreaM2, polygonWidthM } from "./equalAreaProjection";
import { releaseKey } from "./geographyKeys";
import { CLIPPING_VERSION, intersectWithin } from "./pieceIntersection";
import { readGeometries } from "./rawAreaGeometries";

export const round = (value: number, places: number) =>
	Math.round(value * 10 ** places) / 10 ** places;

export const labelsFor = (
	crosswalkId: string,
	areaLookup: AreaLookup | undefined,
	endpoint: { geography: string; boundaryRelease: string },
	code: string,
) => {
	const identity = releaseKey(endpoint.geography, endpoint.boundaryRelease);
	const area = areaLookup?.get(identity)?.get(code);
	if (!area) {
		throw new Error(
			`${crosswalkId}: ${code} has geometry but no compiled identity in ${identity}.`,
		);
	}
	return [area.name];
};

const formatCodes = (entries: Array<[string, number]>) =>
	entries
		.slice(0, 10)
		.map(([code, value]) => `${code} (${value.toFixed(4)})`)
		.join(", ");

export const compileAreaOverlapCrosswalk = (
	repositoryRoot: string,
	adapter: AreaOverlapCrosswalkAdapter,
	geometrySources: GeometrySourceLookup,
	areaLookup: AreaLookup | undefined,
): AreaOverlapCrosswalkArtifact => {
	const minimumTargetCoverage =
		adapter.minimumTargetCoverage ?? adapter.minimumCoverage;
	const excludedPairs = adapter.excludedPairs ?? {};
	const declaredExcludedPairs = new Set(
		Object.entries(excludedPairs).flatMap(([sourceCode, targets]) =>
			Object.keys(targets).map(
				(targetCode) => `${sourceCode}|${targetCode}`,
			),
		),
	);
	const appliedExcludedPairs = new Set<string>();
	const includedPairs = adapter.includedPairs ?? {};
	const declaredIncludedPairs = new Set(
		Object.entries(includedPairs).flatMap(([sourceCode, targets]) =>
			Object.keys(targets).map(
				(targetCode) => `${sourceCode}|${targetCode}`,
			),
		),
	);
	const bothDeclared = [...declaredIncludedPairs].filter((pair) =>
		declaredExcludedPairs.has(pair),
	);
	if (bothDeclared.length > 0)
		throw new Error(
			`${adapter.id}: pairs are both excluded and included: ${bothDeclared.slice(0, 10).join(", ")}`,
		);
	const appliedIncludedPairs = new Set<string>();
	const misplacedIncludedPairs: string[] = [];
	let indeterminateOverlapPairCount = 0;
	// Pairs too near the sliver rule to call, named when the compile refuses.
	const undecidedPairs: string[] = [];
	let sourceCodePattern: RegExp | undefined;
	if (adapter.sourceCodePattern) {
		try {
			sourceCodePattern = new RegExp(adapter.sourceCodePattern);
		} catch {
			throw new Error(
				`${adapter.id}: sourceCodePattern is not a valid regular expression`,
			);
		}
	}
	const sources = readGeometries(
		repositoryRoot,
		adapter.id,
		adapter.from,
		geometrySources,
		sourceCodePattern,
	);
	const targets = readGeometries(
		repositoryRoot,
		adapter.id,
		adapter.to,
		geometrySources,
	);

	let candidatePairCount = 0;
	let intersectingPairCount = 0;
	let sliverPairCount = 0;
	let widestSliverWidthM: number | null = null;
	let narrowestOverlapWidthM = Infinity;
	const overlapsBySource = new Map<
		string,
		Array<{ code: string; overlapAreaM2: number }>
	>();
	const coveredAreaByTarget = new Map<string, number>();

	for (const [sourceCode, source] of sources.geometries) {
		const overlaps: Array<{ code: string; overlapAreaM2: number }> = [];
		for (const [targetCode, target] of targets.geometries) {
			const excluded = excludedPairs[sourceCode]?.[targetCode];
			if (excluded !== undefined) {
				appliedExcludedPairs.add(`${sourceCode}|${targetCode}`);
				continue;
			}
			if (!boundsIntersect(source.bounds, target.bounds)) continue;
			candidatePairCount += 1;
			const intersectionPieces = source.pieces.flatMap((sourcePiece) =>
				candidatePieces(target, sourcePiece).flatMap((targetPiece) =>
					boundsIntersect(sourcePiece.bounds, targetPiece.bounds)
						? intersectWithin(sourcePiece, targetPiece)
						: [],
				),
			);
			// Source or target releases can split one logical area across
			// adjacent features. Re-union the small, local intersections so the
			// sliver check still evaluates the complete source/target overlap.
			const [firstIntersection, ...remainingIntersections] =
				intersectionPieces;
			const intersection = firstIntersection
				? polygonClipping.union(
						firstIntersection,
						...remainingIntersections,
					)
				: [];
			const overlapAreaM2 = multiPolygonAreaM2(intersection);
			if (overlapAreaM2 <= 0) continue;
			intersectingPairCount += 1;
			// Classify the pair by its widest piece: a real overlap may also
			// contain narrow fragments, such as islands, that belong to it.
			const widthM = Math.max(...intersection.map(polygonWidthM));
			if (includedPairs[sourceCode]?.[targetCode] !== undefined) {
				// A reviewed overlap is kept, and kept out of the threshold's
				// evidence, only while it lies where the rule cannot decide.
				const pair = `${sourceCode}|${targetCode}`;
				appliedIncludedPairs.add(pair);
				if (
					widthM < adapter.sliverWidthM / 2 ||
					widthM >= adapter.sliverWidthM * 2
				)
					misplacedIncludedPairs.push(
						`${pair} (${widthM.toFixed(1)} m)`,
					);
				overlaps.push({ code: targetCode, overlapAreaM2 });
				coveredAreaByTarget.set(
					targetCode,
					(coveredAreaByTarget.get(targetCode) ?? 0) + overlapAreaM2,
				);
				continue;
			}
			const indeterminate =
				widthM >= adapter.sliverWidthM / 2 &&
				widthM < adapter.sliverWidthM * 2;
			if (indeterminate && adapter.indeterminatePairs) {
				// The adapter has decided the whole band at once, so these
				// pairs, like reviewed ones, are kept out of the evidence.
				indeterminateOverlapPairCount += 1;
				overlaps.push({ code: targetCode, overlapAreaM2 });
				coveredAreaByTarget.set(
					targetCode,
					(coveredAreaByTarget.get(targetCode) ?? 0) + overlapAreaM2,
				);
				continue;
			}
			if (indeterminate)
				undecidedPairs.push(
					`${sourceCode}|${targetCode} (${widthM.toFixed(1)} m, ${((100 * overlapAreaM2) / source.areaM2).toFixed(3)}% of source, ${((100 * overlapAreaM2) / target.areaM2).toFixed(3)}% of target)`,
				);
			if (widthM < adapter.sliverWidthM) {
				sliverPairCount += 1;
				widestSliverWidthM = Math.max(widestSliverWidthM ?? 0, widthM);
				continue;
			}
			narrowestOverlapWidthM = Math.min(narrowestOverlapWidthM, widthM);
			overlaps.push({ code: targetCode, overlapAreaM2 });
			coveredAreaByTarget.set(
				targetCode,
				(coveredAreaByTarget.get(targetCode) ?? 0) + overlapAreaM2,
			);
		}
		overlapsBySource.set(sourceCode, overlaps);
	}
	const unappliedExcludedPairs = [...declaredExcludedPairs].filter(
		(pair) => !appliedExcludedPairs.has(pair),
	);
	if (unappliedExcludedPairs.length > 0) {
		throw new Error(
			`${adapter.id}: excluded pairs do not exist in the declared geometry: ${unappliedExcludedPairs.slice(0, 10).join(", ")}`,
		);
	}
	const unappliedIncludedPairs = [...declaredIncludedPairs].filter(
		(pair) => !appliedIncludedPairs.has(pair),
	);
	if (unappliedIncludedPairs.length > 0)
		throw new Error(
			`${adapter.id}: included pairs do not overlap in the declared geometry: ${unappliedIncludedPairs.slice(0, 10).join(", ")}`,
		);
	if (misplacedIncludedPairs.length > 0)
		throw new Error(
			`${adapter.id}: included pairs are no longer near the ${adapter.sliverWidthM} m sliver rule, so need no review: ${misplacedIncludedPairs.slice(0, 10).join(", ")}`,
		);
	if (adapter.indeterminatePairs && indeterminateOverlapPairCount === 0)
		throw new Error(
			`${adapter.id}: no pair is near the ${adapter.sliverWidthM} m sliver rule, so indeterminatePairs decides nothing.`,
		);

	// A threshold is only trustworthy while no pair sits near it. Fail rather
	// than publish a split that a slightly different threshold would change.
	if (
		(widestSliverWidthM !== null &&
			widestSliverWidthM >= adapter.sliverWidthM / 2) ||
		narrowestOverlapWidthM < adapter.sliverWidthM * 2
	) {
		throw new Error(
			`${adapter.id}: sliver separation is ambiguous around ${adapter.sliverWidthM} m: widest sliver ${widestSliverWidthM?.toFixed(1)} m, narrowest overlap ${narrowestOverlapWidthM.toFixed(1)} m. Review ${undecidedPairs.length} pairs: ${undecidedPairs.slice(0, 20).join("; ")}.`,
		);
	}

	const sourceCoverage: Array<[string, number]> = [];
	const records = [...overlapsBySource].map(([sourceCode, overlaps]) => {
		const source = sources.geometries.get(sourceCode) as AreaGeometry;
		const coveredAreaM2 = overlaps.reduce(
			(total, overlap) => total + overlap.overlapAreaM2,
			0,
		);
		const coverage = coveredAreaM2 / source.areaM2;
		sourceCoverage.push([sourceCode, coverage]);
		return {
			source: {
				code: sourceCode,
				labels: labelsFor(
					adapter.id,
					areaLookup,
					adapter.from,
					sourceCode,
				),
				areaM2: Math.round(source.areaM2),
				coverage: round(coverage, 6),
			},
			targets: overlaps.map(
				({ code, overlapAreaM2 }): AreaOverlapTarget => ({
					code,
					labels: labelsFor(adapter.id, areaLookup, adapter.to, code),
					weight: round(overlapAreaM2 / coveredAreaM2, 6),
					overlapAreaM2: Math.round(overlapAreaM2),
					sourceShare: round(overlapAreaM2 / source.areaM2, 6),
					targetShare: round(
						overlapAreaM2 /
							(targets.geometries.get(code) as AreaGeometry)
								.areaM2,
						6,
					),
				}),
			),
		};
	});
	const targetCoverage: Array<[string, number]> = [...targets.geometries].map(
		([code, target]) => [
			code,
			(coveredAreaByTarget.get(code) ?? 0) / target.areaM2,
		],
	);

	const byCoverage = (left: [string, number], right: [string, number]) =>
		left[1] - right[1];
	sourceCoverage.sort(byCoverage);
	targetCoverage.sort(byCoverage);
	// A reviewed source is held to its own, declared lower bar, and only
	// while it needs one.
	const exceptions = adapter.coverageExceptions ?? {};
	const coverageOf = new Map(sourceCoverage);
	const staleExceptions = Object.keys(exceptions).filter((code) => {
		const coverage = coverageOf.get(code);
		return coverage === undefined || coverage >= adapter.minimumCoverage;
	});
	if (staleExceptions.length > 0)
		throw new Error(
			`${adapter.id}: coverage exceptions are for sources not below ${adapter.minimumCoverage} covered: ${staleExceptions.slice(0, 10).join(", ")}`,
		);
	for (const [side, coverage, minimumCoverage] of [
		["source", sourceCoverage, adapter.minimumCoverage],
		["target", targetCoverage, minimumTargetCoverage],
	] as const) {
		const below = coverage.filter(
			([code, value]) =>
				value <
				(side === "source"
					? (exceptions[code]?.minimumCoverage ?? minimumCoverage)
					: minimumCoverage),
		);
		if (below.length > 0) {
			throw new Error(
				`${adapter.id}: ${below.length} ${side} areas are less than ${minimumCoverage} covered: ${formatCodes(below)}`,
			);
		}
	}

	const endpoints = {
		from: validateEndpoint(
			adapter.id,
			"from",
			adapter.from,
			new Set(records.map((record) => record.source.code)),
			areaLookup,
		),
		to: validateEndpoint(
			adapter.id,
			"to",
			adapter.to,
			new Set(
				records.flatMap((record) =>
					record.targets.map((target) => target.code),
				),
			),
			areaLookup,
		),
	};

	const artifactWithoutHash = {
		schemaVersion: 1 as const,
		id: adapter.id,
		method: adapter.method,
		quality: adapter.quality,
		weighting: adapter.weighting,
		from: {
			geography: adapter.from.geography,
			boundaryRelease: adapter.from.boundaryRelease,
		},
		to: {
			geography: adapter.to.geography,
			boundaryRelease: adapter.to.boundaryRelease,
		},
		provenance: {
			inputs: [
				{
					side: "from" as const,
					...sources.provenance,
					...(adapter.sourceCodePattern
						? { sourceCodePattern: adapter.sourceCodePattern }
						: {}),
				},
				{ side: "to" as const, ...targets.provenance },
			],
			...(adapter.excludedPairs === undefined
				? {}
				: { excludedPairs: adapter.excludedPairs }),
			...(adapter.includedPairs === undefined
				? {}
				: { includedPairs: adapter.includedPairs }),
			...(adapter.indeterminatePairs === undefined
				? {}
				: { indeterminatePairs: adapter.indeterminatePairs }),
			...(adapter.coverageExceptions === undefined
				? {}
				: { coverageExceptions: adapter.coverageExceptions }),
			areaProjection: "EPSG:6933" as const,
			clipping: `polygon-clipping@${CLIPPING_VERSION}`,
		},
		validation: {
			sourceNameConflicts: [],
			endpoints,
			overlap: {
				candidatePairCount,
				intersectingPairCount,
				sliverPairCount,
				...(adapter.indeterminatePairs === undefined
					? {}
					: { indeterminateOverlapPairCount }),
				sliverWidthM: adapter.sliverWidthM,
				widestSliverWidthM:
					widestSliverWidthM === null
						? null
						: round(widestSliverWidthM, 1),
				narrowestOverlapWidthM: round(narrowestOverlapWidthM, 1),
				minimumCoverage: adapter.minimumCoverage,
				...(adapter.minimumTargetCoverage === undefined
					? {}
					: { minimumTargetCoverageRequired: minimumTargetCoverage }),
				minimumSourceCoverage: round(sourceCoverage[0]?.[1] ?? 0, 6),
				minimumTargetCoverage: round(targetCoverage[0]?.[1] ?? 0, 6),
			},
		},
		records,
	};
	return {
		...artifactWithoutHash,
		contentHash: `sha256:${createHash("sha256")
			.update(JSON.stringify(artifactWithoutHash))
			.digest("hex")}`,
	};
};

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
