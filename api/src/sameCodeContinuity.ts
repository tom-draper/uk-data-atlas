import { createHash } from "node:crypto";
import type { MultiPolygon } from "polygon-clipping";
import type { GeometrySourceLookup } from "./areaGeometry";
import type { AreaLookup } from "./areaInventory";
import { BoundedClipper } from "./boundedClipping";
import {
	CLIPPING_VERSION,
	labelsFor,
	multiPolygonAreaM2,
	polygonWidthM,
	readGeometries,
	round,
	type AreaGeometry,
} from "./areaOverlap";
import type { SameCodeContinuityCrosswalkAdapter } from "./crosswalkAdapters";
import type { SameCodeContinuityCrosswalkArtifact } from "./crosswalkInventory";
import { validateEndpoint } from "./crosswalkValidation";

// About a millimetre. Rounding only feeds a retry, when polygon-clipping's
// sweep line fails on near-coincident edges.
const RETRY_PRECISION = 1e8;

// Every pair measured so far clips in well under two seconds; a clip that
// runs this long has hit polygon-clipping's non-terminating case.
const CLIP_TIMEOUT_MS = 30_000;

const multiPolygon = (
	geometry: AreaGeometry,
	precision?: number,
): MultiPolygon =>
	geometry.pieces.map(({ geometry: polygon }) =>
		precision === undefined
			? polygon
			: polygon.map((ring) =>
					ring.map(
						([x, y]) =>
							[
								Math.round(x * precision) / precision,
								Math.round(y * precision) / precision,
							] as [number, number],
					),
				),
	);

/**
 * Where two releases of one code disagree: the symmetric difference of the
 * whole multipolygons, retried at a millimetre's precision if the clipper
 * fails, or why it could not be measured.
 */
const difference = (
	clipper: BoundedClipper,
	source: AreaGeometry,
	target: AreaGeometry,
): { geometry: MultiPolygon } | { reason: string } => {
	const first = clipper.clip(
		"xor",
		multiPolygon(source),
		multiPolygon(target),
	);
	if (first.status === "clipped") return { geometry: first.geometry };
	const retry = clipper.clip(
		"xor",
		multiPolygon(source, RETRY_PRECISION),
		multiPolygon(target, RETRY_PRECISION),
	);
	return retry.status === "clipped"
		? { geometry: retry.geometry }
		: {
				reason: `${first.reason} Retried at 1e-8 degrees: ${retry.reason}`,
			};
};

/**
 * Pair the codes two releases of one geography share, as identity.
 *
 * GSS codes are meant to change when a boundary does, but a code can survive
 * a realignment, and a recycled code need not mean the same place. So a shared
 * code is only evidence. The two geometries' symmetric difference is judged by
 * its widest piece (twice area over perimeter), the rule the area-overlap
 * crosswalks use for slivers: independently generalised boundaries disagree
 * in strips a few metres wide, while a moved boundary leaves a piece hundreds
 * of metres wide, whatever the area's size. A share of area cannot make that
 * distinction, because the same strip is a larger share of a small area.
 *
 * A pair is published when every piece is narrower than half `sliverWidthM`.
 * Within a factor of two of it the pair is indeterminate, and beyond that its
 * extent changed; both are listed, as repair evidence for a later area overlap
 * or official lookup, and never treated as identity. So is a code the clipper
 * cannot measure.
 */
export const compileSameCodeContinuityCrosswalk = (
	repositoryRoot: string,
	adapter: SameCodeContinuityCrosswalkAdapter,
	geometrySources: GeometrySourceLookup,
	areaLookup: AreaLookup | undefined,
): SameCodeContinuityCrosswalkArtifact => {
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
	const sourceAreas = areaLookup?.get(
		`${adapter.from.geography}/${adapter.from.boundaryRelease}`,
	);
	const targetAreas = areaLookup?.get(
		`${adapter.to.geography}/${adapter.to.boundaryRelease}`,
	);
	type Continuity =
		SameCodeContinuityCrosswalkArtifact["validation"]["continuity"];
	const records: SameCodeContinuityCrosswalkArtifact["records"] = [];
	const changedExtent: Continuity["changedExtent"] = [];
	const unmeasured: Continuity["unmeasured"] = [];
	let sharedCodeCount = 0;
	const clipper = new BoundedClipper(CLIP_TIMEOUT_MS);
	try {
		for (const [code, source] of sources.geometries) {
			const target = targets.geometries.get(code);
			// A geometry file can hold more than its release identifies, such
			// as English features in a Welsh release; only identified areas
			// are compared.
			if (!target || !sourceAreas?.has(code) || !targetAreas?.has(code))
				continue;
			sharedCodeCount += 1;
			const measured = difference(clipper, source, target);
			if ("reason" in measured) {
				unmeasured.push({ code, reason: measured.reason });
				continue;
			}
			const widestDifferenceM = round(
				Math.max(0, ...measured.geometry.map(polygonWidthM)),
				1,
			);
			// The overlap is what the difference leaves of the two areas.
			const overlapAreaM2 = Math.max(
				0,
				(source.areaM2 +
					target.areaM2 -
					multiPolygonAreaM2(measured.geometry)) /
					2,
			);
			const sourceShare = round(
				Math.min(1, overlapAreaM2 / source.areaM2),
				6,
			);
			const targetShare = round(
				Math.min(1, overlapAreaM2 / target.areaM2),
				6,
			);
			if (widestDifferenceM >= adapter.sliverWidthM / 2) {
				changedExtent.push({
					code,
					relation:
						widestDifferenceM < adapter.sliverWidthM * 2
							? "indeterminate"
							: "changed",
					widestDifferenceM,
					sourceShare,
					targetShare,
				});
				continue;
			}
			records.push({
				source: {
					code,
					labels: labelsFor(
						adapter.id,
						areaLookup,
						adapter.from,
						code,
					),
				},
				targets: [
					{
						code,
						labels: labelsFor(
							adapter.id,
							areaLookup,
							adapter.to,
							code,
						),
						widestDifferenceM,
						sourceShare,
						targetShare,
					},
				],
			});
		}
	} finally {
		clipper.close();
	}
	records.sort((left, right) =>
		left.source.code.localeCompare(right.source.code),
	);
	changedExtent.sort(
		(left, right) =>
			right.widestDifferenceM - left.widestDifferenceM ||
			left.code.localeCompare(right.code),
	);
	unmeasured.sort((left, right) => left.code.localeCompare(right.code));
	const codes = new Set(records.map((record) => record.source.code));
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
					codes,
					areaLookup,
				),
				to: validateEndpoint(
					adapter.id,
					"to",
					adapter.to,
					codes,
					areaLookup,
				),
			},
			continuity: {
				sliverWidthM: adapter.sliverWidthM,
				sourceAreaCount: sourceAreas?.size ?? 0,
				targetAreaCount: targetAreas?.size ?? 0,
				sharedCodeCount,
				continuousCount: records.length,
				changedExtent,
				unmeasured,
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
