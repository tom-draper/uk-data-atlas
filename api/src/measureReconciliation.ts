import {
	componentsThroughSteps,
	convertThroughSteps,
	type ConversionMethod,
	type ConversionStep,
} from "./conversion";
import {
	isNumericObservation,
	type DataCatalog,
	type MeasureSource,
} from "./dataCatalog";
import { measureCoverage } from "./measureCoverage";
import { observationsFor } from "./observationArtifacts";
import type { RelationshipPath } from "./relationshipPaths";
import { buildTranslationSteps } from "./resolver/translation";
import { releaseKey } from "./geographyKeys";
import type { RouteContext } from "./routing";

type Measure = DataCatalog["measures"][number];

/** How far apart two published figures may be and still be called agreeing. */
export const RECONCILIATION_TOLERANCE = 0.005;

/** How many ranked paths the index tries per pair of releases. */
const MAX_LISTED_PATH_ATTEMPTS = 5;

export type ReconciledArea = {
	areaCode: string;
	/** What the coarser partition publishes for this area. */
	published: number;
	/** What the finer partition adds up to through the crosswalk. */
	aggregated: number;
	difference: number;
	/** The difference as a share of the published figure. */
	share: number;
	/**
	 * `incomplete` where the finer partition has no value for some of the
	 * areas the crosswalk puts in this one, so the sum was always going to
	 * fall short: a gap, not a disagreement.
	 */
	status: "agrees" | "differs" | "incomplete";
	/** Areas of the finer geography with no value, where the sum is short. */
	missingComponentCount?: number;
};

export type MeasureReconciliation = {
	measure: { id: string; unit: string };
	period: string;
	/**
	 * `verified` where the compatibility inventory has assessed each partition
	 * against the release its end of the crosswalk uses, `by-codes` where the
	 * pairing rests on the codes the crosswalk carries.
	 */
	pairing: "verified" | "by-codes";
	/** The crosswalk added up through, when one was named. */
	crosswalk?: CrosswalkReference;
	/** The published relationship path added up through, when one was named. */
	path?: {
		id: string;
		purpose: RelationshipPath["purpose"];
		origin: RelationshipPath["origin"];
		quality: RelationshipPath["quality"];
		steps: Array<{ direction: "forward" | "reverse"; crosswalk: CrosswalkReference }>;
	};
	/** The partition added up, and the one it is compared against. */
	from: { datasetId: string; geography: string; boundaryYear: number };
	against: { datasetId: string; geography: string; boundaryYear: number };
	method: ConversionMethod;
	areas: ReconciledArea[];
	/** Areas one side has and the other does not, which are not compared. */
	unmatched: {
		aggregatedOnly: string[];
		publishedOnly: string[];
	};
	summary: {
		comparedAreaCount: number;
		agreeingAreaCount: number;
		differingAreaCount: number;
		incompleteAreaCount: number;
		medianAbsoluteShare: number;
		largestDifference?: ReconciledArea;
		publishedTotal: number;
		aggregatedTotal: number;
	};
	tolerance: number;
	note: string;
};

type CrosswalkReference = {
	id: string;
	method: string;
	quality: string;
	href: string;
};

const crosswalkReference = (crosswalk: {
	id: string;
	method: string;
	quality: string;
}): CrosswalkReference => ({
	id: crosswalk.id,
	method: crosswalk.method,
	quality: crosswalk.quality,
	href: `/v1/crosswalks/${crosswalk.id}`,
});

/** The crosswalk or published path a caller names to add one geography up through. */
export type ReconciliationRouteRequest = { crosswalk: string } | { path: string };

type ReconciliationRoute = {
	/** How refusals name the route, such as `crosswalk x` or `path y`. */
	label: string;
	from: { geography: string; boundaryRelease: string };
	to: { geography: string; boundaryRelease: string };
	steps: ConversionStep[];
	reference: Pick<MeasureReconciliation, "crosswalk" | "path">;
};

const resolveRoute = (
	context: RouteContext,
	request: ReconciliationRouteRequest,
): ReconciliationRoute | { refusal: string } => {
	const resolver = context.geographyResolver;
	if ("crosswalk" in request) {
		const summary = resolver.crosswalkSummary(request.crosswalk);
		const crosswalk = resolver.crosswalk(request.crosswalk);
		if (!summary || !crosswalk)
			return { refusal: `No published crosswalk is named ${request.crosswalk}.` };
		return {
			label: request.crosswalk,
			from: summary.from,
			to: summary.to,
			steps: [
				{
					artifact: crosswalk,
					direction: "forward",
					steps: buildTranslationSteps(crosswalk, "forward"),
				},
			],
			reference: { crosswalk: crosswalkReference(summary) },
		};
	}
	const path = resolver.relationshipPath(request.path);
	if (!path)
		return { refusal: `No published relationship path is named ${request.path}.` };
	const indexed = resolver.indexedPathSteps(path);
	if ("missingCrosswalkId" in indexed)
		return {
			refusal: `The crosswalk ${indexed.missingCrosswalkId} required by path ${path.id} is not built.`,
		};
	return {
		label: `path ${path.id}`,
		from: path.from,
		to: path.to,
		steps: indexed.steps,
		reference: {
			path: {
				id: path.id,
				purpose: path.purpose,
				origin: path.origin,
				quality: path.quality,
				steps: indexed.steps.map(({ artifact, direction }) => ({
					direction,
					crosswalk: crosswalkReference(artifact),
				})),
			},
		},
	};
};

const numericRecords = (
	measureId: string,
	source: MeasureSource,
	period: string,
	artifacts: Parameters<typeof observationsFor>[3],
) => {
	const observations = observationsFor(measureId, source, period, artifacts);
	if (!observations) return undefined;
	const records = observations.records.filter(isNumericObservation);
	// A partition with a non-numeric record is not summed at all, rather than
	// summed over the part of it that happens to be numeric.
	return records.length === observations.records.length ? records : undefined;
};

/**
 * Every partition of a measure and the releases its codes join, keyed as
 * dataset/vintage/release. A join means every source code is present on the
 * release, which is what adding one geography up into another rests on.
 */
const joinablePartitions = (context: RouteContext, measure: Measure) => {
	const coverage =
		context.dataCatalog && context.measureCompatibilityInventory
			? measureCoverage(
					context.dataCatalog,
					context.measureCompatibilityInventory,
					measure.id,
				)
			: undefined;
	return new Set(
		(coverage?.sources ?? []).flatMap((source) =>
			source.boundaryCoverage
				.filter((candidate) => candidate.eligibleForCodeJoin)
				.map(
					(candidate) =>
						`${source.dataset.id}/${source.sourceGeography.boundaryYear}/${candidate.boundaryRelease}`,
				),
		),
	);
};

/** The releases each geography's partitions of a measure are verified to join. */
const joinableReleases = (context: RouteContext, measure: Measure) => {
	const releases = new Map<string, Set<string>>();
	const coverage =
		context.dataCatalog && context.measureCompatibilityInventory
			? measureCoverage(
					context.dataCatalog,
					context.measureCompatibilityInventory,
					measure.id,
				)
			: undefined;
	for (const source of coverage?.sources ?? []) {
		const held = releases.get(source.sourceGeography.type) ?? new Set<string>();
		for (const candidate of source.boundaryCoverage)
			if (candidate.eligibleForCodeJoin) held.add(candidate.boundaryRelease);
		releases.set(source.sourceGeography.type, held);
	}
	return releases;
};

/**
 * Whether a path can carry a sum at all: a reversed step splits each area
 * among its parts, which only an overlap's published weights can apportion.
 */
const summable = (path: RelationshipPath) =>
	path.steps.every(
		(step) =>
			step.direction === "forward" ||
			step.method === "area-overlap" ||
			step.method === "population-overlap",
	);

/**
 * Check a measure against itself across two geographies.
 *
 * Where the same measure is published on a fine geography and a coarse one,
 * adding the fine one up through a published crosswalk should reproduce the
 * coarse one. Both figures are the publisher's, so a disagreement is evidence:
 * about the crosswalk, about a boundary vintage, or about the data. The Atlas
 * holds enough to run the comparison, and publishing it is what makes a
 * conversion trustworthy rather than merely available.
 *
 * Nothing is corrected here. The two figures are reported side by side with
 * their difference, and a caller decides which to believe.
 */
export const reconcileMeasure = (
	context: RouteContext,
	measure: Measure,
	request: ReconciliationRouteRequest,
	period: string,
): MeasureReconciliation | { refusal: string } => {
	const route = resolveRoute(context, request);
	if ("refusal" in route) return route;
	const { label } = route;
	if (measure.aggregation.kind !== "extensive")
		return {
			refusal: `${measure.id} is ${measure.aggregation.kind}; only a measure whose values add over areas can be reconciled by adding one geography up into another.`,
		};
	const artifacts = {
		populationObservations: context.populationObservations,
		populationLocalAuthorityObservations:
			context.populationLocalAuthorityObservations,
		measureObservations: context.measureObservations,
	};
	// Each side is paired with the partition published on the release its end
	// of the crosswalk uses. Where the compatibility inventory has assessed
	// that pairing it is `verified`; otherwise the partition whose codes the
	// crosswalk end carries most of is taken, and the pairing is `by-codes`,
	// because a partition of another vintage may still be the same areas. A
	// pairing that is not the same areas shows up as areas short of their
	// parts, which are reported as `incomplete` rather than as disagreement.
	const joins = joinablePartitions(context, measure);
	const partition = (
		end: { geography: string; boundaryRelease: string },
		codes: Set<string>,
	) => {
		const candidates = measure.sources.filter(
			(source) =>
				source.sourceGeography.type === end.geography &&
				source.periods.includes(period),
		);
		const verified = candidates.find((source) =>
			joins.has(
				`${source.datasetId}/${source.sourceGeography.boundaryYear}/${end.boundaryRelease}`,
			),
		);
		if (verified) return { source: verified, pairing: "verified" as const };
		const overlap = (source: MeasureSource) =>
			(
				numericRecords(measure.id, source, period, artifacts) ?? []
			).filter((record) => codes.has(record.areaCode)).length;
		const [best] = candidates
			.map((source) => ({ source, matched: overlap(source) }))
			.filter((candidate) => candidate.matched > 0)
			.sort((left, right) => right.matched - left.matched);
		return best
			? { source: best.source, pairing: "by-codes" as const }
			: undefined;
	};
	// Which areas of the finer geography the route puts in each coarser
	// one, so a sum short of its parts is reported as short rather than as a
	// disagreement with the publisher.
	const componentsOf = componentsThroughSteps(route.steps);
	const sourceCodes = new Set(route.steps[0]?.steps.keys() ?? []);
	const targetCodes = new Set(componentsOf.keys());
	const fine = partition(route.from, sourceCodes);
	const coarse = partition(route.to, targetCodes);
	const from = fine?.source;
	const against = coarse?.source;
	if (!from || !against)
		return {
			refusal: `${measure.id} is not published for ${period} on partitions whose codes ${label} carries on both sides, so there is nothing to compare through it.`,
		};
	const fineRecords = numericRecords(measure.id, from, period, artifacts);
	const coarseRecords = numericRecords(
		measure.id,
		against,
		period,
		artifacts,
	);
	if (!fineRecords || !coarseRecords)
		return {
			refusal: `No numeric observations are published for ${period} on both sides of ${label}.`,
		};
	const valued = new Set(fineRecords.map((record) => record.areaCode));
	const converted = convertThroughSteps(
		route.steps,
		fineRecords.filter((record) => sourceCodes.has(record.areaCode)),
	);
	if (converted.status !== "converted")
		return {
			refusal: `The ${route.from.geography} partition does not convert through ${label}: ${converted.reason}`,
		};
	const published = new Map(
		coarseRecords.map((record) => [record.areaCode, record.value]),
	);
	const aggregated = new Map(
		converted.records.map((record) => [record.areaCode, record.value]),
	);
	const areas: ReconciledArea[] = [];
	for (const [areaCode, value] of aggregated) {
		const held = published.get(areaCode);
		if (held === undefined) continue;
		const difference = value - held;
		const share =
			held === 0 ? (difference === 0 ? 0 : 1) : difference / held;
		const missing = [...(componentsOf.get(areaCode) ?? [])].filter(
			(code) => !valued.has(code),
		).length;
		areas.push({
			areaCode,
			published: held,
			aggregated: Number(value.toPrecision(12)),
			difference: Number(difference.toPrecision(12)),
			share: Number(share.toPrecision(6)),
			status:
				missing > 0
					? "incomplete"
					: Math.abs(share) <= RECONCILIATION_TOLERANCE
						? "agrees"
						: "differs",
			...(missing > 0 ? { missingComponentCount: missing } : {}),
		});
	}
	// Disagreements first, because a sum short of its parts is already
	// explained by the parts it is missing.
	areas.sort(
		(left, right) =>
			Number(left.status === "incomplete") -
				Number(right.status === "incomplete") ||
			Math.abs(right.share) - Math.abs(left.share) ||
			left.areaCode.localeCompare(right.areaCode),
	);
	const shares = areas
		.filter((area) => area.status !== "incomplete")
		.map((area) => Math.abs(area.share))
		.sort((left, right) => left - right);
	const total = (values: Iterable<number>) =>
		Number(
			[...values].reduce((sum, value) => sum + value, 0).toPrecision(12),
		);
	return {
		measure: { id: measure.id, unit: measure.unit },
		period,
		pairing:
			fine!.pairing === "verified" && coarse!.pairing === "verified"
				? "verified"
				: "by-codes",
		...route.reference,
		from: {
			datasetId: from.datasetId,
			geography: from.sourceGeography.type,
			boundaryYear: from.sourceGeography.boundaryYear,
		},
		against: {
			datasetId: against.datasetId,
			geography: against.sourceGeography.type,
			boundaryYear: against.sourceGeography.boundaryYear,
		},
		method: converted.method,
		areas,
		unmatched: {
			aggregatedOnly: [...aggregated.keys()]
				.filter((code) => !published.has(code))
				.sort(),
			publishedOnly: [...published.keys()]
				.filter((code) => !aggregated.has(code))
				.sort(),
		},
		summary: {
			comparedAreaCount: areas.length,
			agreeingAreaCount: areas.filter((area) => area.status === "agrees")
				.length,
			differingAreaCount: areas.filter(
				(area) => area.status === "differs",
			).length,
			incompleteAreaCount: areas.filter(
				(area) => area.status === "incomplete",
			).length,
			medianAbsoluteShare: shares.length
				? Number(
						(
							shares[Math.floor((shares.length - 1) / 2)] ?? 0
						).toPrecision(6),
					)
				: 0,
			...(areas[0] && areas[0].status !== "incomplete"
				? { largestDifference: areas[0] }
				: {}),
			publishedTotal: total(areas.map((area) => area.published)),
			aggregatedTotal: total(areas.map((area) => area.aggregated)),
		},
		tolerance: RECONCILIATION_TOLERANCE,
		note: "Both figures are the publisher's own. A difference is evidence about the crosswalk, the boundary vintage or the data, and nothing here is corrected.",
	};
};

/** The reconciliations a measure's published partitions and crosswalks allow. */
export const availableReconciliations = (
	context: RouteContext,
	measure: Measure,
) => {
	const geographies = new Map<string, MeasureSource[]>();
	for (const source of measure.sources) {
		const held = geographies.get(source.sourceGeography.type) ?? [];
		held.push(source);
		geographies.set(source.sourceGeography.type, held);
	}
	// The periods both geographies publish, in the finer one's order.
	const sharedPeriods = (fromGeography: string, toGeography: string) => {
		const coarse = geographies.get(toGeography) ?? [];
		return (geographies.get(fromGeography) ?? []).flatMap((source) =>
			source.periods.filter((period) =>
				coarse.some((candidate) => candidate.periods.includes(period)),
			),
		);
	};
	const crosswalks = context.geographyResolver.crosswalkSummaries().flatMap(
		(crosswalk) => {
			// A crosswalk within one geography relates two vintages of the
			// same areas; adding a partition up through it would compare it
			// with itself.
			if (crosswalk.from.geography === crosswalk.to.geography) return [];
			const periods = sharedPeriods(
				crosswalk.from.geography,
				crosswalk.to.geography,
			);
			return periods.length > 0
				? [
						{
							crosswalk: {
								id: crosswalk.id,
								method: crosswalk.method,
								quality: crosswalk.quality,
							},
							from: crosswalk.from,
							against: crosswalk.to,
							periods: [...new Set(periods)].sort(),
							href: `/v1/measures/${measure.id}/reconciliation?crosswalk=${crosswalk.id}&period=${periods.at(-1)}`,
						},
					]
				: [];
		},
	);
	// Composed paths are listed more narrowly than crosswalks, because there
	// are far more of them and most cannot carry this measure. Only paths
	// between releases its partitions are verified to join are tried, in the
	// resolver's rank order, and the first that reconciles the latest shared
	// period is listed for each pair of releases and purpose. A path that
	// drops a partition code, such as a continuity step that leaves out
	// changed areas, is refused by the conversion and so is never offered.
	// A single-step path is its crosswalk, which is already listed.
	const joins = joinableReleases(context, measure);
	const endpoints = new Map<string, RelationshipPath>();
	for (const path of context.geographyResolver.publishedRelationshipPaths()) {
		if (
			path.steps.length < 2 ||
			path.from.geography === path.to.geography ||
			!joins.get(path.from.geography)?.has(path.from.boundaryRelease) ||
			!joins.get(path.to.geography)?.has(path.to.boundaryRelease) ||
			sharedPeriods(path.from.geography, path.to.geography).length === 0
		)
			continue;
		endpoints.set(
			[
				releaseKey(path.from.geography, path.from.boundaryRelease),
				releaseKey(path.to.geography, path.to.boundaryRelease),
				path.purpose,
			].join("|"),
			path,
		);
	}
	const paths = [...endpoints.entries()]
		.sort(([left], [right]) => left.localeCompare(right))
		.flatMap(([, { from, to, purpose }]) => {
			const periods = [...new Set(sharedPeriods(from.geography, to.geography))].sort();
			const latest = periods.at(-1)!;
			const path = context.geographyResolver
				.relationshipCapability(from, to, purpose)
				.paths.filter(
					(candidate) => candidate.steps.length > 1 && summable(candidate),
				)
				// Each attempt converts the whole partition, so only the best
				// few are tried; the ranking puts complete coverage first.
				.slice(0, MAX_LISTED_PATH_ATTEMPTS)
				.find(
					(candidate) =>
						!("refusal" in
							reconcileMeasure(context, measure, { path: candidate.id }, latest)),
				);
			if (!path) return [];
			return [
				{
					path: {
						id: path.id,
						purpose: path.purpose,
						origin: path.origin,
						quality: path.quality,
						steps: path.steps.map(({ crosswalkId, direction }) => ({
							crosswalkId,
							direction,
						})),
					},
					from: path.from,
					against: path.to,
					periods,
					href: `/v1/measures/${measure.id}/reconciliation?path=${encodeURIComponent(path.id)}&period=${latest}`,
				},
			];
		});
	return [...crosswalks, ...paths];
};
