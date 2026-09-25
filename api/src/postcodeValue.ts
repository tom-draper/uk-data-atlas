import type { Measure, MeasureSource } from "./dataCatalog";
import type {
	CompatibilityCandidate,
	MeasureCompatibilityInventory,
} from "./measureCompatibility";
import type { Dispatch } from "./placeValue";
import {
	locatePoints,
	type LookupPoint,
	type PointMatch,
	type PointResult,
} from "./pointLookup";
import type { RouteContext } from "./routing";

/**
 * Answering "what is this measure where this postcode is?".
 *
 * A measure is published for areas of one geography as they were drawn in one
 * year. The postcode's centroid is placed in a boundary release holding that
 * partition's codes, so the area found is one the data was published for, in
 * the data's own vintage rather than today's boundaries. The value is then read
 * through the series route, so every rule and refusal it applies holds here.
 */

const STATUS_RANK: Record<CompatibilityCandidate["status"], number> = {
	"exact-code-set": 0,
	"code-set-compatible": 1,
	"partial-code-overlap": 2,
	"no-code-overlap": 3,
};

/** The newest source of each geography the measure is published on for the period. */
export const postcodeSources = (
	measure: Measure,
	period: string | undefined,
	boundaryYear: number | undefined,
) => {
	const byGeography = new Map<string, MeasureSource>();
	for (const source of measure.sources) {
		if (period !== undefined && !source.periods.includes(period)) continue;
		if (
			boundaryYear !== undefined &&
			source.sourceGeography.boundaryYear !== boundaryYear
		)
			continue;
		const existing = byGeography.get(source.sourceGeography.type);
		if (
			!existing ||
			source.sourceGeography.boundaryYear >
				existing.sourceGeography.boundaryYear
		)
			byGeography.set(source.sourceGeography.type, source);
	}
	return [...byGeography.values()];
};

/**
 * The boundary releases a source's codes can be found in, best first: those
 * holding every code before those holding most, then by the share held.
 * A release sharing no code is never a candidate.
 */
export const sourceReleases = (
	inventory: MeasureCompatibilityInventory,
	measureId: string,
	source: MeasureSource,
): CompatibilityCandidate[] => {
	const compiled = inventory.measures
		.find((entry) => entry.measureId === measureId)
		?.sources.find(
			(entry) =>
				entry.datasetId === source.datasetId &&
				entry.sourceGeography.type === source.sourceGeography.type &&
				entry.sourceGeography.boundaryYear ===
					source.sourceGeography.boundaryYear,
		);
	return [...(compiled?.candidates ?? [])]
		.filter((candidate) => candidate.status !== "no-code-overlap")
		.sort(
			(left, right) =>
				STATUS_RANK[left.status] - STATUS_RANK[right.status] ||
				right.matchedSourceShare - left.matchedSourceShare ||
				left.boundaryRelease.localeCompare(right.boundaryRelease),
		);
};

export type PostcodePlacement =
	| {
			placed: true;
			release: CompatibilityCandidate;
			result: PointResult;
	  }
	| { placed: false; reason: string };

/**
 * Place a point in the first of a source's releases that has geometry to test.
 * A release whose geometry cannot be read is passed over for the next.
 */
export const placeInSource = (
	context: RouteContext,
	point: LookupPoint,
	geography: string,
	releases: CompatibilityCandidate[],
): PostcodePlacement => {
	const resolver = context.geographyResolver;
	let reason = `No compiled ${geography} boundary release holds the source's area codes.`;
	for (const candidate of releases) {
		const release = resolver.boundaryRelease(
			geography,
			candidate.boundaryRelease,
		);
		if (!release || !resolver.hasAreaRelease(geography, release.id))
			continue;
		const [{ results }] = locatePoints(
			context,
			resolver,
			{
				releases: [
					{
						status: "selected",
						geography,
						boundaryRelease: release.id,
						release,
						selection: { policy: "pinned" },
					},
				],
			},
			[point],
		) as [ReturnType<typeof locatePoints>[number]];
		const result = results[0]!;
		if (result.status === "geometry-unavailable") {
			reason = result.detail ?? reason;
			continue;
		}
		return { placed: true, release: candidate, result };
	}
	return { placed: false, reason };
};

export type SeriesAnswer = {
	period: string;
	periodDefaulted: boolean;
	status: string;
	value?: number;
	category?: string;
	confidenceInterval?: { lower: number; upper: number };
};

/** The published value for one area of a source, through the series route. */
export const readSeries = (
	measure: Measure,
	source: MeasureSource,
	match: PointMatch,
	period: string | undefined,
	dispatch: Dispatch,
): { via: string; answer: SeriesAnswer } | { via: string; reason: string } => {
	const { type, boundaryYear } = source.sourceGeography;
	const via = `/v1/data/${measure.id}/series?areaCode=${encodeURIComponent(match.code)}&geography=${type}&boundaryYear=${boundaryYear}`;
	const response = dispatch(via);
	if (response.status !== 200)
		return {
			via,
			reason:
				(response.body as { detail?: string } | undefined)?.detail ??
				"Not served.",
		};
	const series = (
		response.body as {
			data: { series: (SeriesAnswer & { areaCode: string })[] };
		}
	).data.series;
	const entry = period
		? series.find((point) => point.period === period)
		: series.at(-1);
	if (!entry)
		return {
			via,
			reason: period
				? `${match.code} has no ${measure.id} for ${period}.`
				: `${match.code} has no ${measure.id} observations.`,
		};
	const { areaCode: _areaCode, ...answer } = entry;
	return { via, answer: { ...answer, periodDefaulted: !period } };
};

export type SourceAttempt =
	| {
			outcome: "answered";
			source: MeasureSource;
			release: CompatibilityCandidate;
			result: PointResult;
			match: PointMatch;
			answer: SeriesAnswer;
			via: string;
	  }
	| {
			outcome: "ambiguous";
			source: MeasureSource;
			choices: Array<{
				match: PointMatch;
				answer: SeriesAnswer;
				via: string;
			}>;
	  }
	| { outcome: "unserved"; source: MeasureSource; reason: string };

/** Place the point in one source's areas and read the value published there. */
export const attemptSource = (
	context: RouteContext,
	measure: Measure,
	source: MeasureSource,
	releases: CompatibilityCandidate[],
	point: LookupPoint,
	postcode: string,
	period: string | undefined,
	dispatch: Dispatch,
): SourceAttempt => {
	const { type } = source.sourceGeography;
	const placement = placeInSource(context, point, type, releases);
	if (!placement.placed)
		return { outcome: "unserved", source, reason: placement.reason };
	const { result, release } = placement;
	if (result.matches.length === 0)
		return {
			outcome: "unserved",
			source,
			reason: `${postcode} lies in no ${type} area of ${release.boundaryRelease}. ${result.detail ?? ""}`.trim(),
		};
	const read = result.matches.map((match) => ({
		match,
		...readSeries(measure, source, match, period, dispatch),
	}));
	const answered = read.flatMap((entry) =>
		"answer" in entry
			? [{ match: entry.match, answer: entry.answer, via: entry.via }]
			: [],
	);
	if (answered.length === 0)
		return {
			outcome: "unserved",
			source,
			reason: `${postcode} lies in ${read.map((entry) => entry.match.id).join(" and ")}, which ${measure.id} does not answer: ${read.map((entry) => ("reason" in entry ? entry.reason : "")).join(" ")}`,
		};
	if (answered.length > 1)
		return { outcome: "ambiguous", source, choices: answered };
	return {
		outcome: "answered",
		source,
		release,
		result,
		...answered[0]!,
	};
};
