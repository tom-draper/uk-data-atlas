import { createHash } from "node:crypto";
import type { MultiPolygon } from "polygon-clipping";
import type { GeometrySourceLookup } from "./areaGeometry";
import { releaseKey } from "./geographyKeys";
import type { AreaLookup } from "./areaInventory";
import {
	type AreaGeometry,
	areaMultiPolygon,
	boundsIntersect,
} from "./areaGeometryPieces";
import { labelsFor, round } from "./areaOverlap";
import { CLIPPING_VERSION } from "./pieceIntersection";
import { readGeometries } from "./rawAreaGeometries";
import { multiPolygonAreaM2, polygonWidthM } from "./equalAreaProjection";
import { BoundedClipper } from "./boundedClipping";
import type {
	BestFitCrosswalkAdapter,
	GeometricContainmentCrosswalkAdapter,
} from "./crosswalkAdapters";
import type { GeographyKind } from "./geography";
import type {
	BestFitCrosswalkArtifact,
	GeometricContainmentCrosswalkArtifact,
} from "./crosswalkInventory";
import { validateEndpoint } from "./crosswalkValidation";

// About a millimetre, then about ten centimetres, for retries when
// polygon-clipping's sweep line fails; both far below any sliver width.
const RETRY_PRECISIONS = [1e8, 1e6];

// A pair clips in well under a second; one that runs this long has hit
// polygon-clipping's non-terminating case.
const CLIP_TIMEOUT_MS = 30_000;

export type ContainedArea = {
	code: string;
	/** The parent holding most of it, and the share of its area there. */
	parent?: string;
	share: number;
	/**
	 * How far the child reaches beyond that parent, as the width of the widest
	 * piece left outside it: noise where borders were generalised apart, or a
	 * child that genuinely straddles.
	 */
	outsideWidthM: number;
	relation: "within" | "indeterminate" | "straddles" | "unmeasured";
	reason?: string;
};

export type ContainmentMeasurement = {
	childCount: number;
	parentCount: number;
	areas: ContainedArea[];
	/** Set when the measurement stopped early, so `areas` is partial. */
	abandoned?: { after: number; reason: string };
};

/**
 * Judge each child of one release against the parents of another.
 *
 * A child belongs to the parent holding most of it, and the claim is tested
 * by what is left outside: independently generalised borders leave strips a
 * few metres wide, while a child that genuinely straddles leaves a piece
 * hundreds of metres wide. That is the rule the area-overlap crosswalks use
 * for slivers, and it holds whatever the child's size, which a share of area
 * does not: the same strip is a larger share of a data zone than of a county.
 */
export const measureContainment = (
	repositoryRoot: string,
	crosswalkId: string,
	from: { geography: GeographyKind; boundaryRelease: string },
	to: { geography: GeographyKind; boundaryRelease: string },
	geometrySources: GeometrySourceLookup,
	sliverWidthM: number,
	/**
	 * Give up once this many children are not within one parent. A search for
	 * hierarchies that geometry might establish passes a small number, because
	 * a pair that is not a containment shows it immediately.
	 */
	abandonAfter = Infinity,
	/** Reuse releases already read, when many pairs share a side. */
	cache?: Map<string, ReturnType<typeof readGeometries>>,
): ContainmentMeasurement => {
	const release = (endpoint: {
		geography: GeographyKind;
		boundaryRelease: string;
	}) => {
		const key = releaseKey(endpoint.geography, endpoint.boundaryRelease);
		const held = cache?.get(key);
		if (held) return held;
		const read = readGeometries(
			repositoryRoot,
			crosswalkId,
			endpoint,
			geometrySources,
		);
		cache?.set(key, read);
		return read;
	};
	const children = release(from);
	const parents = release(to);
	const clipper = new BoundedClipper(CLIP_TIMEOUT_MS);
	const areas: ContainedArea[] = [];
	let abandoned: ContainmentMeasurement["abandoned"];
	let refused = 0;
	try {
		for (const code of [...parents.geometries.keys()].sort())
			clipper.register(
				`parent/${code}`,
				areaMultiPolygon(parents.geometries.get(code)!),
			);
		for (const [code, child] of [...children.geometries].sort(
			([left], [right]) => left.localeCompare(right),
		)) {
			const geometry = areaMultiPolygon(child);
			const clip = (
				operation: "intersection" | "difference",
				parent: string,
			) => {
				let result = clipper.clip(
					operation,
					geometry,
					`parent/${parent}`,
				);
				for (const precision of RETRY_PRECISIONS) {
					if (result.status === "clipped") break;
					result = clipper.clip(
						operation,
						areaMultiPolygon(child, precision),
						`parent/${parent}`,
					);
				}
				return result;
			};
			let best: { code: string; areaM2: number } | undefined;
			let failure: string | undefined;
			for (const [parentCode, parent] of parents.geometries) {
				if (!boundsIntersect(child.bounds, parent.bounds)) continue;
				const overlap = clip("intersection", parentCode);
				if (overlap.status !== "clipped") {
					failure = overlap.reason;
					break;
				}
				const areaM2 = multiPolygonAreaM2(overlap.geometry);
				if (!best || areaM2 > best.areaM2)
					best = { code: parentCode, areaM2 };
			}
			if (failure) {
				areas.push({
					code,
					share: 0,
					outsideWidthM: 0,
					relation: "unmeasured",
					reason: failure,
				});
				refused += 1;
				continue;
			}
			if (!best || best.areaM2 <= 0) {
				areas.push({
					code,
					share: 0,
					outsideWidthM: Infinity,
					relation: "straddles",
					reason: "No parent holds any of it.",
				});
				if (++refused >= abandonAfter) {
					abandoned = {
						after: areas.length,
						reason: `${refused} areas are not within one ${to.geography} of ${to.boundaryRelease}.`,
					};
					break;
				}
				continue;
			}
			const outside = clip("difference", best.code);
			if (outside.status !== "clipped") {
				areas.push({
					code,
					parent: best.code,
					share: round(Math.min(1, best.areaM2 / child.areaM2), 6),
					outsideWidthM: 0,
					relation: "unmeasured",
					reason: outside.reason,
				});
				continue;
			}
			const outsideWidthM = round(
				Math.max(0, ...outside.geometry.map(polygonWidthM)),
				1,
			);
			areas.push({
				code,
				parent: best.code,
				share: round(Math.min(1, best.areaM2 / child.areaM2), 6),
				outsideWidthM,
				relation:
					outsideWidthM < sliverWidthM / 2
						? "within"
						: outsideWidthM < sliverWidthM * 2
							? "indeterminate"
							: "straddles",
			});
			if (
				areas.at(-1)!.relation !== "within" &&
				++refused >= abandonAfter
			) {
				abandoned = {
					after: areas.length,
					reason: `${refused} areas are not within one ${to.geography} of ${to.boundaryRelease}.`,
				};
				break;
			}
		}
	} finally {
		clipper.close();
	}
	return {
		childCount: children.geometries.size,
		parentCount: parents.geometries.size,
		areas,
		...(abandoned ? { abandoned } : {}),
	};
};

/**
 * Publish a hierarchy no publisher lookup covers, where geometry establishes
 * it. Every child must sit within one parent: a release with a child that
 * straddles, or that the clipper cannot measure, is not a containment and the
 * build refuses it rather than publishing a membership that is not one.
 */
export const compileGeometricContainmentCrosswalk = (
	repositoryRoot: string,
	adapter: GeometricContainmentCrosswalkAdapter,
	geometrySources: GeometrySourceLookup,
	areaLookup: AreaLookup | undefined,
): GeometricContainmentCrosswalkArtifact => {
	const measured = measureContainment(
		repositoryRoot,
		adapter.id,
		adapter.from,
		adapter.to,
		geometrySources,
		adapter.sliverWidthM,
	);
	const refused = measured.areas.filter((area) => area.relation !== "within");
	if (refused.length > 0)
		throw new Error(
			`${adapter.id}: ${refused.length} of ${measured.childCount} areas do not sit within one ${adapter.to.geography}: ${refused
				.slice(0, 10)
				.map(
					(area) =>
						`${area.code} (${area.relation}${area.parent ? `, ${area.outsideWidthM} m outside ${area.parent}` : ""})`,
				)
				.join(", ")}`,
		);
	const records = measured.areas.map((area) => ({
		source: {
			code: area.code,
			labels: labelsFor(adapter.id, areaLookup, adapter.from, area.code),
		},
		targets: [
			{
				code: area.parent!,
				labels: labelsFor(
					adapter.id,
					areaLookup,
					adapter.to,
					area.parent!,
				),
				containedShare: area.share,
				outsideWidthM: area.outsideWidthM,
			},
		],
	}));
	const sources = readGeometries(
		repositoryRoot,
		adapter.id,
		adapter.from,
		geometrySources,
	);
	const targets = readGeometries(
		repositoryRoot,
		adapter.id,
		adapter.to,
		geometrySources,
	);
	const artifactWithoutHash = {
		schemaVersion: 1 as const,
		id: adapter.id,
		method: adapter.method,
		quality: adapter.quality,
		relationshipPurpose: adapter.relationshipPurpose,
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
				{ side: "from" as const, ...sources.provenance },
				{ side: "to" as const, ...targets.provenance },
			],
			areaProjection: "EPSG:6933" as const,
			clipping: `polygon-clipping@${CLIPPING_VERSION}`,
		},
		validation: {
			sourceNameConflicts: [],
			endpoints: {
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
					new Set(records.map((record) => record.targets[0]!.code)),
					areaLookup,
				),
			},
			containment: {
				sliverWidthM: adapter.sliverWidthM,
				childCount: measured.childCount,
				parentCount: measured.parentCount,
				/** Parents that hold no child of this release. */
				childlessParentCount:
					measured.parentCount -
					new Set(records.map((record) => record.targets[0]!.code))
						.size,
				minimumContainedShare: round(
					Math.min(...measured.areas.map((area) => area.share)),
					6,
				),
				widestOutsideM: Math.max(
					...measured.areas.map((area) => area.outsideWidthM),
				),
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
 * Publish the parent of another geography holding most of each child, where
 * the two do not nest: wards and the constituencies they mostly lie in. Each
 * child keeps the relation containment would give it, so a reader can tell a
 * ward within its constituency from one placed there by most of its area. A
 * child the clipper cannot measure, or that no parent touches, has no best
 * fit, and the build refuses the release rather than leave it out.
 */
export const compileBestFitCrosswalk = (
	repositoryRoot: string,
	adapter: BestFitCrosswalkAdapter,
	geometrySources: GeometrySourceLookup,
	areaLookup: AreaLookup | undefined,
): BestFitCrosswalkArtifact => {
	const cache = new Map<string, ReturnType<typeof readGeometries>>();
	const measured = measureContainment(
		repositoryRoot,
		adapter.id,
		adapter.from,
		adapter.to,
		geometrySources,
		adapter.sliverWidthM,
		Infinity,
		cache,
	);
	const unplaced = measured.areas.filter(
		(area) => area.relation === "unmeasured" || area.parent === undefined,
	);
	if (unplaced.length > 0)
		throw new Error(
			`${adapter.id}: ${unplaced.length} of ${measured.childCount} areas have no best-fit ${adapter.to.geography}: ${unplaced
				.slice(0, 10)
				.map((area) => `${area.code} (${area.reason ?? area.relation})`)
				.join(", ")}`,
		);
	const placed = measured.areas as Array<
		ContainedArea & {
			parent: string;
			relation: "within" | "indeterminate" | "straddles";
		}
	>;
	const records = placed.map((area) => ({
		source: {
			code: area.code,
			labels: labelsFor(adapter.id, areaLookup, adapter.from, area.code),
		},
		targets: [
			{
				code: area.parent,
				labels: labelsFor(
					adapter.id,
					areaLookup,
					adapter.to,
					area.parent,
				),
				containedShare: area.share,
				outsideWidthM: area.outsideWidthM,
				relation: area.relation,
			},
		],
	}));
	const release = (endpoint: BestFitCrosswalkAdapter["from"]) =>
		cache.get(releaseKey(endpoint.geography, endpoint.boundaryRelease))!;
	const count = (relation: ContainedArea["relation"]) =>
		placed.filter((area) => area.relation === relation).length;
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
				{ side: "from" as const, ...release(adapter.from).provenance },
				{ side: "to" as const, ...release(adapter.to).provenance },
			],
			areaProjection: "EPSG:6933" as const,
			clipping: `polygon-clipping@${CLIPPING_VERSION}`,
		},
		validation: {
			sourceNameConflicts: [],
			endpoints: {
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
					new Set(records.map((record) => record.targets[0]!.code)),
					areaLookup,
				),
			},
			bestFit: {
				sliverWidthM: adapter.sliverWidthM,
				childCount: measured.childCount,
				parentCount: measured.parentCount,
				withinCount: count("within"),
				indeterminateCount: count("indeterminate"),
				straddlingCount: count("straddles"),
				minimumContainedShare: round(
					Math.min(...placed.map((area) => area.share)),
					6,
				),
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
