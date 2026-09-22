import type { ConversionMethod } from "./conversion";
import { areaMeasureSources } from "./areaResources";
import { notBuilt, unsupported } from "./capability";
import { convertObservations } from "./conversion";
import { isNumericObservation, type DataCatalog } from "./dataCatalog";
import { measureCoverage } from "./measureCoverage";
import { observationsFor } from "./observationArtifacts";
import type { RouteContext } from "./routing";

type Measure = DataCatalog["measures"][number];
type Target = { geography: string; boundaryRelease: string; code?: string };

export type MeasureConversionPath = {
	crosswalk: { id: string; method: string; quality: string };
	source: {
		datasetId: string;
		geography: string;
		boundaryYear: number;
		period: string;
	};
	method: ConversionMethod;
	href: string;
};

export type MeasureCapability =
	| {
			status: "available" | "partial";
			reason?: string;
			sources: ReturnType<typeof areaMeasureSources> | ReleaseSource[];
	  }
	| {
			status: "requires-conversion";
			reason: string;
			conversions: MeasureConversionPath[];
	  }
	| { status: "unsupported" | "not-built"; reason: string };

type ReleaseSource = {
	dataset: { id: string; href: string };
	sourceGeography: Measure["sources"][number]["sourceGeography"];
	periods: string[];
	eligibleForCodeJoin: boolean;
	matchingSourceAreaShare: number;
	candidateOnlyAreaCount: number;
};

// Conversions are dry-run once per measure, source and crosswalk: the Atlas
// release a context serves never changes, so neither does the outcome. Only
// the path and the target codes it reaches are kept, not the values.
type DryRun = { path: MeasureConversionPath; targets: Set<string> } | null;
const dryRuns = new WeakMap<RouteContext, Map<string, DryRun>>();

/**
 * The conversions the convert route would accept onto a target: an extensive
 * measure, a crosswalk from the source partition's geography to the target
 * release, and a dry run of that exact conversion on the latest period that
 * does not refuse. A path is only offered once it is known to work.
 */
const conversionsOnto = (
	context: RouteContext,
	measure: Measure,
	target: Target,
): MeasureConversionPath[] => {
	const { crosswalkInventory, crosswalkLookup } = context;
	if (!crosswalkInventory || !crosswalkLookup) return [];
	let cache = dryRuns.get(context);
	if (!cache) {
		cache = new Map();
		dryRuns.set(context, cache);
	}
	const artifacts = {
		populationObservations: context.populationObservations,
		populationLocalAuthorityObservations:
			context.populationLocalAuthorityObservations,
		measureObservations: context.measureObservations,
	};
	return measure.sources.flatMap((source) =>
		crosswalkInventory.crosswalks
			.filter(
				(crosswalk) =>
					crosswalk.from.geography === source.sourceGeography.type &&
					crosswalk.to.geography === target.geography &&
					crosswalk.to.boundaryRelease === target.boundaryRelease,
			)
			.flatMap((summary) => {
				const period = source.periods.at(-1);
				if (!period) return [];
				const key = [
					measure.id,
					source.datasetId,
					source.sourceGeography.type,
					source.sourceGeography.boundaryYear,
					period,
					summary.id,
				].join("/");
				if (!cache.has(key)) {
					const crosswalk = crosswalkLookup.get(summary.id);
					const observations = observationsFor(
						measure.id,
						source,
						period,
						artifacts,
					);
					const records =
						observations?.records.filter(isNumericObservation) ??
						[];
					const result =
						crosswalk &&
						observations &&
						records.length === observations.records.length
							? convertObservations(crosswalk, records)
							: undefined;
					cache.set(
						key,
						result?.status === "converted"
							? {
									path: {
										crosswalk: {
											id: summary.id,
											method: summary.method,
											quality: summary.quality,
										},
										source: {
											datasetId: source.datasetId,
											geography:
												source.sourceGeography.type,
											boundaryYear:
												source.sourceGeography
													.boundaryYear,
											period,
										},
										method: result.method,
										href: `/v1/data/${measure.id}/convert?period=${period}&geography=${source.sourceGeography.type}&boundaryYear=${source.sourceGeography.boundaryYear}&crosswalk=${summary.id}`,
									},
									targets: new Set(
										result.records.map(
											(record) => record.areaCode,
										),
									),
								}
							: null,
					);
				}
				const dryRun = cache.get(key);
				if (!dryRun) return [];
				if (target.code && !dryRun.targets.has(target.code)) return [];
				return [dryRun.path];
			}),
	);
};

/**
 * Whether the Atlas can give a measure on a geography release, or for one
 * area of it, in the capability vocabulary.
 *
 * A source partition published on the release answers directly: in full when
 * every source code joins it and, for an area, the area has a value in every
 * period, and in part otherwise. With no such partition, a conversion that the
 * convert route accepts is offered instead. A measure whose values do not add
 * over areas is never converted.
 */
export const measureCapability = (
	context: RouteContext,
	measure: Measure,
	target: Target,
): MeasureCapability => {
	const { dataCatalog, measureCompatibilityInventory } = context;
	if (!dataCatalog || !measureCompatibilityInventory)
		return notBuilt(
			"Build the data catalogue and measure compatibility before describing a measure's capability.",
		);
	const coverage = measureCoverage(
		dataCatalog,
		measureCompatibilityInventory,
		measure.id,
	);
	const release = `${target.geography}/${target.boundaryRelease}`;
	if (target.code !== undefined) {
		const sources = areaMeasureSources(
			measure,
			coverage,
			target.geography,
			target.boundaryRelease,
			target.code,
			{
				populationObservations: context.populationObservations,
				populationLocalAuthorityObservations:
					context.populationLocalAuthorityObservations,
				measureObservations: context.measureObservations,
			},
		);
		if (sources.length > 0) {
			const periods = sources.flatMap((source) => source.periods);
			const present = periods.filter(
				(period) => period.availability === "present",
			);
			const joinable = sources.some(
				(source) => source.codeSetCompatibility.eligibleForCodeJoin,
			);
			if (present.length === periods.length && joinable)
				return { status: "available", sources };
			if (present.length > 0)
				return {
					status: "partial",
					reason: joinable
						? `The area has a value in ${present.length} of ${periods.length} published periods.`
						: `The source's codes only partly match ${release}, so values are not joined to it in full.`,
					sources,
				};
			return unsupported(
				`A source is published on ${release}, but it has no value for this area in any period, typically because it covers fewer countries.`,
			);
		}
	} else {
		const sources = (coverage?.sources ?? []).flatMap((covered) => {
			if (covered.sourceGeography.type !== target.geography) return [];
			const candidate = covered.boundaryCoverage.find(
				(entry) => entry.boundaryRelease === target.boundaryRelease,
			);
			return candidate
				? [
						{
							dataset: covered.dataset,
							sourceGeography: covered.sourceGeography,
							periods: covered.periods,
							eligibleForCodeJoin: candidate.eligibleForCodeJoin,
							matchingSourceAreaShare:
								candidate.matchingSourceAreaShare,
							candidateOnlyAreaCount:
								candidate.candidateOnlyAreaCount,
						},
					]
				: [];
		});
		if (sources.length > 0) {
			const complete = sources.find(
				(source) =>
					source.eligibleForCodeJoin &&
					source.candidateOnlyAreaCount === 0,
			);
			if (complete) return { status: "available", sources };
			return {
				status: "partial",
				reason: sources.some((source) => source.eligibleForCodeJoin)
					? `Every source value joins ${release}, but the release has areas the source gives no value for.`
					: `The source's codes only partly match ${release}.`,
				sources,
			};
		}
	}
	if (measure.aggregation.kind !== "extensive")
		return unsupported(
			`No source partition is published on ${release}, and this measure's values do not add over areas, so none is converted onto it.`,
		);
	const conversions = conversionsOnto(context, measure, target);
	if (conversions.length > 0)
		return {
			status: "requires-conversion",
			reason: `No source partition is published on ${release}; ${conversions.length === 1 ? "a published crosswalk converts one" : `${conversions.length} published crosswalks convert one`} onto it.`,
			conversions,
		};
	return unsupported(
		`No source partition is published on ${release}, and no published crosswalk converts one onto it${target.code ? " for this area" : ""}.`,
	);
};
