import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import polygonClipping, {
	type MultiPolygon,
	type Pair,
	type Polygon,
	type Ring,
} from "polygon-clipping";
import type { GeometrySourceLookup } from "./areaGeometry";
import type { AreaLookup } from "./areaInventory";
import { releaseKey } from "./geographyKeys";
import {
	canServeAsWgs84,
	geometryProvenance,
	toWgs84Geometry,
} from "./reprojection";
import { appliesTo, offsetGeometry, readGridOffset } from "./gridOffset";
import { readShapefileFeatures } from "./shapefile";
import type { AreaOverlapCrosswalkAdapter } from "./crosswalkAdapters";
import type { GeographyKind } from "./geography";
import type {
	AreaOverlapCrosswalkArtifact,
	AreaOverlapTarget,
} from "./crosswalkInventory";
import { validateEndpoint } from "./crosswalkValidation";

export const CLIPPING_VERSION = (
	createRequire(import.meta.url)("polygon-clipping/package.json") as {
		version: string;
	}
).version;

// WGS 84 ellipsoid.
const A = 6378137;
const F = 1 / 298.257223563;
const E2 = F * (2 - F);
const E = Math.sqrt(E2);

// EPSG:6933 (WGS 84 / NSIDC EASE-Grid 2.0 Global): Lambert cylindrical
// equal-area on the ellipsoid with a 30° standard parallel. Any polygon's
// projected area is its area on the ellipsoid, so areas need no correction.
const K0 =
	Math.cos(Math.PI / 6) / Math.sqrt(1 - E2 * Math.sin(Math.PI / 6) ** 2);

const authalicQ = (sinLat: number) =>
	(1 - E2) *
	(sinLat / (1 - E2 * sinLat * sinLat) -
		(1 / (2 * E)) * Math.log((1 - E * sinLat) / (1 + E * sinLat)));

export const projectEqualArea = ([lon, lat]: Pair): Pair => [
	A * K0 * ((lon * Math.PI) / 180),
	(A * authalicQ(Math.sin((lat * Math.PI) / 180))) / (2 * K0),
];

const authalicQPrime = (sinLat: number) => {
	const w = 1 - E2 * sinLat * sinLat;
	return (1 - E2) * ((1 + E2 * sinLat * sinLat) / (w * w) + 1 / w);
};

/**
 * The inverse of projectEqualArea. Longitude is linear in x and simply
 * divides out; latitude needs authalicQ inverted, which Newton's method does
 * in a handful of steps because the function increases monotonically in
 * sin(latitude) and its derivative never vanishes on the ellipsoid.
 */
export const unprojectEqualArea = ([x, y]: Pair): Pair => {
	const target = (2 * K0 * y) / A;
	let sinLat = Math.max(-1, Math.min(1, target / (1 - E2 / 3)));
	for (let step = 0; step < 12; step += 1) {
		const delta =
			(authalicQ(sinLat) - target) / authalicQPrime(sinLat) || 0;
		sinLat = Math.max(-1, Math.min(1, sinLat - delta));
		if (Math.abs(delta) < 1e-15) break;
	}
	return [
		((x / (A * K0)) * 180) / Math.PI,
		(Math.asin(sinLat) * 180) / Math.PI,
	];
};

const ringAreaM2 = (ring: Ring) => {
	const projected = ring.map(projectEqualArea);
	let twiceArea = 0;
	for (let i = 0, j = projected.length - 1; i < projected.length; j = i++) {
		twiceArea +=
			(projected[j][0] - projected[i][0]) *
			(projected[j][1] + projected[i][1]);
	}
	return Math.abs(twiceArea / 2);
};

export const polygonAreaM2 = ([outer, ...holes]: Polygon) =>
	ringAreaM2(outer) -
	holes.reduce((total, hole) => total + ringAreaM2(hole), 0);

export const multiPolygonAreaM2 = (multiPolygon: MultiPolygon) =>
	multiPolygon.reduce((total, polygon) => total + polygonAreaM2(polygon), 0);

// Ground length of a short edge from the ellipsoid's radii of curvature at
// its mid-latitude. Edges here are metres to a few kilometres long, where
// this agrees with the geodesic to well under a part in a million.
export const edgeLengthM = ([lon1, lat1]: Pair, [lon2, lat2]: Pair) => {
	const sinLat = Math.sin((((lat1 + lat2) / 2) * Math.PI) / 180);
	const w = Math.sqrt(1 - E2 * sinLat * sinLat);
	const meridional = (A * (1 - E2)) / (w * w * w);
	const primeVertical = (A / w) * Math.sqrt(1 - sinLat * sinLat);
	return Math.hypot(
		(((lon2 - lon1) * Math.PI) / 180) * primeVertical,
		(((lat2 - lat1) * Math.PI) / 180) * meridional,
	);
};

const ringPerimeterM = (ring: Ring) => {
	let perimeter = 0;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		perimeter += edgeLengthM(ring[j], ring[i]);
	}
	return perimeter;
};

/** Every ring's ground length, holes included: the boundary drawn on land. */
export const polygonPerimeterM = (polygon: Polygon) =>
	polygon.reduce((total, ring) => total + ringPerimeterM(ring), 0);

/**
 * Twice area over perimeter: the width of a strip with this polygon's area
 * and perimeter. Slivers left where two independently generalised boundaries
 * disagree are metres wide; real overlaps are hundreds of metres or more.
 */
export const polygonWidthM = (polygon: Polygon) => {
	const perimeter = polygonPerimeterM(polygon);
	return perimeter === 0 ? 0 : (2 * polygonAreaM2(polygon)) / perimeter;
};

type Bounds = [number, number, number, number];

type GeometryPiece = { geometry: Polygon; bounds: Bounds };
export type AreaGeometry = {
	pieces: GeometryPiece[];
	bounds: Bounds;
	areaM2: number;
	/** Spatial buckets avoid comparing every offshore island to every source. */
	pieceBuckets: Map<string, number[]>;
};

const PIECE_BUCKET_SIZE_DEGREES = 0.25;

const bucketRange = ([west, south, east, north]: Bounds) => ({
	west: Math.floor(west / PIECE_BUCKET_SIZE_DEGREES),
	south: Math.floor(south / PIECE_BUCKET_SIZE_DEGREES),
	east: Math.floor(east / PIECE_BUCKET_SIZE_DEGREES),
	north: Math.floor(north / PIECE_BUCKET_SIZE_DEGREES),
});

const bucketKey = (x: number, y: number) => `${x}/${y}`;

const indexPieces = (pieces: GeometryPiece[]) => {
	const buckets = new Map<string, number[]>();
	for (const [index, piece] of pieces.entries()) {
		const range = bucketRange(piece.bounds);
		for (let x = range.west; x <= range.east; x += 1)
			for (let y = range.south; y <= range.north; y += 1) {
				const key = bucketKey(x, y);
				const entries = buckets.get(key) ?? [];
				entries.push(index);
				buckets.set(key, entries);
			}
	}
	return buckets;
};

const candidatePieces = (target: AreaGeometry, source: GeometryPiece) => {
	const candidates = new Set<number>();
	const range = bucketRange(source.bounds);
	for (let x = range.west; x <= range.east; x += 1)
		for (let y = range.south; y <= range.north; y += 1)
			for (const index of target.pieceBuckets.get(bucketKey(x, y)) ?? [])
				candidates.add(index);
	return [...candidates].map((index) => target.pieces[index]!);
};

const boundsOf = (multiPolygon: MultiPolygon): Bounds => {
	const bounds: Bounds = [Infinity, Infinity, -Infinity, -Infinity];
	for (const [outer] of multiPolygon) {
		for (const [x, y] of outer) {
			bounds[0] = Math.min(bounds[0], x);
			bounds[1] = Math.min(bounds[1], y);
			bounds[2] = Math.max(bounds[2], x);
			bounds[3] = Math.max(bounds[3], y);
		}
	}
	return bounds;
};

export const boundsIntersect = (left: Bounds, right: Bounds) =>
	left[0] <= right[2] &&
	right[0] <= left[2] &&
	left[1] <= right[3] &&
	right[1] <= left[3];

const toPolygons = (geometry: unknown, description: string): Polygon[] => {
	const { type, coordinates } = geometry as {
		type?: unknown;
		coordinates?: unknown;
	};
	const polygons =
		type === "Polygon"
			? [coordinates]
			: type === "MultiPolygon"
				? coordinates
				: undefined;
	if (!Array.isArray(polygons)) {
		throw new Error(`${description} is not a Polygon or MultiPolygon.`);
	}
	return (polygons as number[][][][]).map((polygon) =>
		polygon.map((ring) => ring.map(([x, y]) => [x, y] as Pair)),
	);
};

export const readGeometries = (
	repositoryRoot: string,
	crosswalkId: string,
	endpoint: { geography: GeographyKind; boundaryRelease: string },
	geometrySources: GeometrySourceLookup,
	codePattern?: RegExp,
) => {
	const identity = releaseKey(endpoint.geography, endpoint.boundaryRelease);
	const source = geometrySources.get(identity);
	if (!source) {
		throw new Error(
			`${crosswalkId}: no raw geometry source is available for ${identity}.`,
		);
	}
	if (!canServeAsWgs84(source.crs)) {
		throw new Error(
			`${crosswalkId}: ${identity} geometry is ${source.crs} and has no transformation to WGS84.`,
		);
	}
	const offsets = (source.corrections ?? []).map((id) =>
		readGridOffset(repositoryRoot, id),
	);
	if (offsets.some((offset) => offset.crs !== source.crs)) {
		throw new Error(
			`${crosswalkId}: ${identity} has a correction for a different CRS.`,
		);
	}
	const inputPath = join(repositoryRoot, "data", source.input);
	const content = readFileSync(inputPath);
	// Shapefiles are read as the geometry cache reads them; the hash is of the
	// input file's bytes either way, as the geometry source registry records.
	const collection = (
		inputPath.toLowerCase().endsWith(".shp")
			? {
					type: "FeatureCollection",
					features: readShapefileFeatures(inputPath),
				}
			: JSON.parse(content.toString("utf8"))
	) as {
		type?: unknown;
		features?: Array<{ properties?: unknown; geometry?: unknown }>;
	};
	if (
		collection.type !== "FeatureCollection" ||
		!Array.isArray(collection.features)
	) {
		throw new Error(
			`${crosswalkId}: ${source.input} is not a FeatureCollection.`,
		);
	}
	const polygonsByCode = new Map<string, Polygon[]>();
	for (const [index, feature] of collection.features.entries()) {
		const code = (feature.properties as Record<string, unknown> | null)?.[
			source.codeProperty
		];
		if (typeof code !== "string" || code.trim().length === 0) {
			throw new Error(
				`${crosswalkId}: ${source.input} feature ${index} has no ${source.codeProperty}.`,
			);
		}
		if (codePattern && !codePattern.test(code)) continue;
		if (typeof feature.geometry !== "object" || feature.geometry === null) {
			throw new Error(
				`${crosswalkId}: ${source.input} feature ${index} (${code}) has no geometry.`,
			);
		}
		const corrected = offsets
			.filter((offset) => appliesTo(offset, code))
			.reduce(
				(geometry, offset) => offsetGeometry(offset, geometry),
				feature.geometry as { type: string; coordinates?: unknown },
			);
		const polygons = polygonsByCode.get(code.trim()) ?? [];
		polygons.push(
			...toPolygons(
				toWgs84Geometry(corrected, source.crs),
				`${source.input} feature ${index} geometry`,
			),
		);
		polygonsByCode.set(code.trim(), polygons);
	}
	const geometries = new Map<string, AreaGeometry>();
	for (const code of [...polygonsByCode.keys()].sort()) {
		const geometry = polygonsByCode.get(code) as MultiPolygon;
		const pieces = geometry.map((polygon) => ({
			geometry: polygon,
			bounds: boundsOf([polygon]),
		}));
		geometries.set(code, {
			pieces,
			bounds: boundsOf(geometry),
			areaM2: multiPolygonAreaM2(geometry),
			pieceBuckets: indexPieces(pieces),
		});
	}
	return {
		geometries,
		provenance: {
			input: source.input,
			inputHash: `sha256:${createHash("sha256").update(content).digest("hex")}`,
			...geometryProvenance(source.crs),
			...(offsets.length > 0
				? {
						corrections: offsets.map(({ id, description }) => ({
							id,
							description,
						})),
					}
				: {}),
		},
	};
};

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
			if (!boundsIntersect(source.bounds, target.bounds)) continue;
			candidatePairCount += 1;
			const intersectionPieces = source.pieces.flatMap((sourcePiece) =>
				candidatePieces(target, sourcePiece).flatMap((targetPiece) =>
					boundsIntersect(sourcePiece.bounds, targetPiece.bounds)
						? polygonClipping.intersection(
								sourcePiece.geometry,
								targetPiece.geometry,
							)
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

	// A threshold is only trustworthy while no pair sits near it. Fail rather
	// than publish a split that a slightly different threshold would change.
	if (
		(widestSliverWidthM !== null &&
			widestSliverWidthM >= adapter.sliverWidthM / 2) ||
		narrowestOverlapWidthM < adapter.sliverWidthM * 2
	) {
		throw new Error(
			`${adapter.id}: sliver separation is ambiguous around ${adapter.sliverWidthM} m: widest sliver ${widestSliverWidthM?.toFixed(1)} m, narrowest overlap ${narrowestOverlapWidthM.toFixed(1)} m.`,
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
	for (const [side, coverage] of [
		["source", sourceCoverage],
		["target", targetCoverage],
	] as const) {
		const below = coverage.filter(
			([, value]) => value < adapter.minimumCoverage,
		);
		if (below.length > 0) {
			throw new Error(
				`${adapter.id}: ${below.length} ${side} areas are less than ${adapter.minimumCoverage} covered: ${formatCodes(below)}`,
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
				sliverWidthM: adapter.sliverWidthM,
				widestSliverWidthM:
					widestSliverWidthM === null
						? null
						: round(widestSliverWidthM, 1),
				narrowestOverlapWidthM: round(narrowestOverlapWidthM, 1),
				minimumCoverage: adapter.minimumCoverage,
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
