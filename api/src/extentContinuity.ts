import { createHash } from "node:crypto";
import type { MultiPolygon } from "polygon-clipping";
import type { GeometrySourceLookup } from "./areaGeometry";
import type { AreaLookup } from "./areaInventory";
import { BoundedClipper } from "./boundedClipping";
import {
	CLIPPING_VERSION,
	boundsIntersect,
	labelsFor,
	multiPolygonAreaM2,
	polygonWidthM,
	readGeometries,
	round,
	type AreaGeometry,
} from "./areaOverlap";
import type { ExtentContinuityCrosswalkAdapter } from "./crosswalkAdapters";
import type { ExtentContinuityCrosswalkArtifact } from "./crosswalkInventory";
import { validateEndpoint } from "./crosswalkValidation";
import { releaseKey } from "./geographyKeys";

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

type Measured = {
	widestDifferenceM: number;
	sourceShare: number;
	targetShare: number;
};

/**
 * The widest piece of two geometries' difference, and the share of each
 * their overlap covers, or why the clipper could not measure them.
 */
const measure = (
	clipper: BoundedClipper,
	source: AreaGeometry,
	target: AreaGeometry,
): Measured | { reason: string } => {
	const measured = difference(clipper, source, target);
	if ("reason" in measured) return measured;
	// The overlap is what the difference leaves of the two areas.
	const overlapAreaM2 = Math.max(
		0,
		(source.areaM2 +
			target.areaM2 -
			multiPolygonAreaM2(measured.geometry)) /
			2,
	);
	return {
		widestDifferenceM: round(
			Math.max(0, ...measured.geometry.map(polygonWidthM)),
			1,
		),
		sourceShare: round(Math.min(1, overlapAreaM2 / source.areaM2), 6),
		targetShare: round(Math.min(1, overlapAreaM2 / target.areaM2), 6),
	};
};

/**
 * How many same-code pairs a release pair needs before its noise is measured
 * well enough to judge a recoded pair against.
 */
export const MINIMUM_NOISE_SAMPLE = 50;

/** The share of same-code pairs whose difference a recoded pair must match. */
const NOISE_QUANTILE = 0.99;

/**
 * Two areas whose sizes differ by more than this cannot differ only by noise,
 * so they are not clipped at all.
 */
const MINIMUM_AREA_RATIO = 0.9;

/**
 * Carry each area of one release onto the next where its extent held, as
 * identity: under the same code, or under a new one.
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
 * A shared code is published when every piece is narrower than half
 * `sliverWidthM`. Within a factor of two of it the pair is indeterminate, and
 * beyond that its extent changed; both are listed, as repair evidence for a
 * later area overlap or official lookup, and never treated as identity. So is
 * a code the clipper cannot measure.
 *
 * Codes also change without the boundary moving, as when a council is
 * reorganised and its wards are renumbered. A code only the first release
 * holds is then paired with a code only the second holds, under a stricter
 * rule, since a new code is itself a sign that something changed: their
 * difference must be no wider than the difference 99% of this release pair's
 * published same-code pairs stay within, which is how far the two releases'
 * generalisation drifts, and the two must choose only each other. A pair
 * released under a new code for a small realignment differs by little more
 * than that, and is listed for review rather than published.
 */
export const compileExtentContinuityCrosswalk = (
	repositoryRoot: string,
	adapter: ExtentContinuityCrosswalkAdapter,
	geometrySources: GeometrySourceLookup,
	areaLookup: AreaLookup | undefined,
): ExtentContinuityCrosswalkArtifact => {
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
		releaseKey(adapter.from.geography, adapter.from.boundaryRelease),
	);
	const targetAreas = areaLookup?.get(
		releaseKey(adapter.to.geography, adapter.to.boundaryRelease),
	);
	type Continuity =
		ExtentContinuityCrosswalkArtifact["validation"]["continuity"];
	type Record = ExtentContinuityCrosswalkArtifact["records"][number];
	const records: Record[] = [];
	const changedExtent: Continuity["changedExtent"] = [];
	const unmeasured: Continuity["unmeasured"] = [];
	let sharedCodeCount = 0;
	const record = (
		sourceCode: string,
		targetCode: string,
		match: "same-code" | "recoded",
		measured: Measured,
	): Record => ({
		source: {
			code: sourceCode,
			labels: labelsFor(adapter.id, areaLookup, adapter.from, sourceCode),
		},
		targets: [
			{
				code: targetCode,
				labels: labelsFor(
					adapter.id,
					areaLookup,
					adapter.to,
					targetCode,
				),
				match,
				...measured,
			},
		],
	});
	// A geometry file can hold more than its release identifies, such as
	// English features in a Welsh release; only identified areas are compared.
	const identified = (
		geometries: Map<string, AreaGeometry>,
		areas: typeof sourceAreas,
	) => [...geometries].filter(([code]) => areas?.has(code));
	const sourceGeometries = identified(sources.geometries, sourceAreas);
	const targetGeometries = identified(targets.geometries, targetAreas);
	let recoded: Continuity["recoded"];
	let continuousCount = 0;
	const clipper = new BoundedClipper(CLIP_TIMEOUT_MS);
	try {
		for (const [code, source] of sourceGeometries) {
			const target = targets.geometries.get(code);
			if (!target || !targetAreas?.has(code)) continue;
			sharedCodeCount += 1;
			const measured = measure(clipper, source, target);
			if ("reason" in measured) {
				unmeasured.push({ code, reason: measured.reason });
				continue;
			}
			if (measured.widestDifferenceM >= adapter.sliverWidthM / 2) {
				changedExtent.push({
					code,
					relation:
						measured.widestDifferenceM < adapter.sliverWidthM * 2
							? "indeterminate"
							: "changed",
					...measured,
				});
				continue;
			}
			records.push(record(code, code, "same-code", measured));
		}
		continuousCount = records.length;
		recoded = compareRecoded(
			clipper,
			adapter,
			records.map((entry) => entry.targets[0]!.widestDifferenceM),
			sourceGeometries.filter(([code]) => !targetAreas?.has(code)),
			targetGeometries.filter(([code]) => !sourceAreas?.has(code)),
			(sourceCode, targetCode, measured) =>
				records.push(
					record(sourceCode, targetCode, "recoded", measured),
				),
		);
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
	const codes = new Set(records.map((entry) => entry.source.code));
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
					new Set(records.map((entry) => entry.targets[0]!.code)),
					areaLookup,
				),
			},
			continuity: {
				sliverWidthM: adapter.sliverWidthM,
				sourceAreaCount: sourceAreas?.size ?? 0,
				targetAreaCount: targetAreas?.size ?? 0,
				sharedCodeCount,
				continuousCount,
				changedExtent,
				unmeasured,
				recoded,
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
 * Pair the codes only the first release holds with those only the second
 * holds, where their extents match to within the release pair's noise.
 */
const compareRecoded = (
	clipper: BoundedClipper,
	adapter: ExtentContinuityCrosswalkAdapter,
	sameCodeWidths: number[],
	retired: Array<[string, AreaGeometry]>,
	introduced: Array<[string, AreaGeometry]>,
	publish: (
		sourceCode: string,
		targetCode: string,
		measured: Measured,
	) => void,
): ExtentContinuityCrosswalkArtifact["validation"]["continuity"]["recoded"] => {
	if (retired.length === 0 || introduced.length === 0)
		return {
			status: "not-compared",
			reason: "No code is held by only one of the two releases on each side.",
		};
	if (sameCodeWidths.length < MINIMUM_NOISE_SAMPLE)
		return {
			status: "not-compared",
			reason: `Only ${sameCodeWidths.length} same-code pairs were published, fewer than the ${MINIMUM_NOISE_SAMPLE} needed to measure how far the releases' generalisation drifts.`,
		};
	const sorted = [...sameCodeWidths].sort((left, right) => left - right);
	const widthCeilingM =
		sorted[Math.ceil(sorted.length * NOISE_QUANTILE) - 1]!;
	const within = new Map<string, Array<[string, Measured]>>();
	const choosers = new Map<string, string[]>();
	const nearMisses: Array<{ code: string; candidate: string } & Measured> =
		[];
	const unmeasured: Array<{
		code: string;
		candidate: string;
		reason: string;
	}> = [];
	for (const [code, source] of retired) {
		for (const [candidate, target] of introduced) {
			if (
				!boundsIntersect(source.bounds, target.bounds) ||
				Math.min(source.areaM2, target.areaM2) /
					Math.max(source.areaM2, target.areaM2) <
					MINIMUM_AREA_RATIO
			)
				continue;
			const measured = measure(clipper, source, target);
			if ("reason" in measured) {
				unmeasured.push({ code, candidate, reason: measured.reason });
				continue;
			}
			if (measured.widestDifferenceM <= widthCeilingM) {
				within.set(code, [
					...(within.get(code) ?? []),
					[candidate, measured],
				]);
				choosers.set(candidate, [
					...(choosers.get(candidate) ?? []),
					code,
				]);
			} else if (measured.widestDifferenceM < adapter.sliverWidthM / 2)
				nearMisses.push({ code, candidate, ...measured });
		}
	}
	const ambiguous: Array<{ code: string; candidates: string[] }> = [];
	let matchedCount = 0;
	for (const [code, matches] of [...within].sort(([left], [right]) =>
		left.localeCompare(right),
	)) {
		const [only] = matches;
		if (matches.length === 1 && choosers.get(only![0])!.length === 1) {
			publish(code, only![0], only![1]);
			matchedCount += 1;
		} else
			ambiguous.push({
				code,
				candidates: matches.map(([candidate]) => candidate).sort(),
			});
	}
	return {
		status: "compared",
		widthCeilingM,
		noiseSampleCount: sorted.length,
		retiredCodeCount: retired.length,
		introducedCodeCount: introduced.length,
		matchedCount,
		ambiguous,
		nearMisses: nearMisses.sort(
			(left, right) =>
				left.widestDifferenceM - right.widestDifferenceM ||
				left.code.localeCompare(right.code),
		),
		unmeasured: unmeasured.sort(
			(left, right) =>
				left.code.localeCompare(right.code) ||
				left.candidate.localeCompare(right.candidate),
		),
	};
};
