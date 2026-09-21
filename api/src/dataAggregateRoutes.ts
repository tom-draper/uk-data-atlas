import { refused, resolveObservations } from "./resolve/observationPlan";
import { statisticPhrase } from "./aggregation";
import { resolveAggregationTarget } from "./aggregationTarget";
import { assessAggregationCoverage } from "./aggregationCoverage";
import type { RouteRequest } from "./routing";
import { problem, type ApiResponse } from "./routeResponse";
import { validateLocationAggregation } from "./locationAggregation";
import { readWeightedSource } from "./weightedSource";
import { calculateWeightedAggregate } from "./weightedAggregation";
import { compatibleReleasesForAggregation } from "./aggregationCompatibility";
import {
	buildAggregateResponse,
	type AggregateWeighting,
} from "./aggregateResponse";
import { parseAggregateQuery } from "./aggregateQuery";
import { readAggregateObservations } from "./aggregateObservations";
import {
	aggregateTargetMembers,
	requireAggregateMembers,
} from "./aggregateTargetMembers";

/** Observations summed over a country, region or named location, with the coverage the total rests on. */
export const handleDataAggregateRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 4 ||
		segments[0] !== "v1" ||
		segments[1] !== "data" ||
		segments[3] !== "aggregate"
	)
		return undefined;
	const {
		areaLookup,
		crosswalkLookup,
		namedLocationLookup,
		dataCatalog,
		populationObservations,
		populationLocalAuthorityObservations,
		measureObservations,
		measureCompatibilityInventory,
	} = context;
	if (!dataCatalog) {
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the data catalogue before aggregating observations.",
		);
	}
	const measureId = segments[2] as string;
	const measure = dataCatalog.measures.find(
		(candidate) => candidate.id === measureId,
	);
	if (!measure)
		return problem(
			404,
			"Not Found",
			"No published measure serves aggregation at that path.",
		);
	const weightedAggregation =
		measure.aggregation.kind === "intensive" &&
		measure.aggregation.operation === "weighted-mean" &&
		measure.aggregation.available
			? measure.aggregation
			: undefined;
	const usesWeightedMean = weightedAggregation !== undefined;
	const usesSum =
		measure.aggregation.kind === "extensive" &&
		measure.aggregation.available;
	if (!usesSum && !usesWeightedMean) {
		return problem(
			422,
			"Operation Not Supported",
			measure.aggregation.kind === "non-aggregatable"
				? `This measure is ${statisticPhrase(measure.aggregation.statistic)} and cannot be combined over areas. ${measure.aggregation.note}`
				: "This measure is not available for aggregation.",
			{ code: "aggregation_not_supported" },
		);
	}
	const query = parseAggregateQuery({ parsedUrl, measureId });
	if ("status" in query) return query;
	const {
		period,
		geography,
		boundaryYear,
		locationId,
		areaCode,
		regionCode,
		targetCode,
		crosswalkId,
		sourceRelease,
	} = query;
	if (locationId && !namedLocationLookup) {
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the named location inventory before aggregating over a location.",
		);
	}
	const location = locationId
		? namedLocationLookup?.get(locationId)
		: undefined;
	if (locationId && !location)
		return problem(
			404,
			"Not Found",
			"No named location matches locationId.",
		);
	// The query parser has established these are present; which partition they
	// name is the resolver's to decide.
	const resolved = resolveObservations(context, {
		measureId,
		periods: [period],
		geography,
		boundaryYear,
	});
	if (resolved.kind === "refusal") return refused(resolved.refusal);
	const { source } = resolved.plan;
	if (location && location.memberGeography !== source.sourceGeography.type)
		return problem(
			422,
			"Operation Not Supported",
			`${location.label} is defined as ${location.memberGeography} codes, but this source partition is ${source.sourceGeography.type}. No conversion was applied.`,
			{ code: "conversion_not_available" },
		);
	// The boundary releases this partition is assessed to match, against
	// which an aggregate's coverage can be judged. This is evidence about a
	// partition rather than a choice of one, so it is read here; the resolver
	// only reports compatibility for a release a caller actually named.
	const compatibleReleases = compatibleReleasesForAggregation({
		measureCompatibilityInventory,
		measureId,
		source,
		period: period as string,
	});
	const regional = resolveAggregationTarget({
		targetCode,
		regionCode,
		crosswalkId,
		sourceRelease,
		source,
		compatibleReleases,
		crosswalkLookup,
		measureCompatibilityInventory,
		areaLookup,
	});
	if (regional && "status" in regional) return regional;
	const numericObservationResult = readAggregateObservations({
		measureId,
		source,
		period: period as string,
		artifacts: {
			populationObservations,
			populationLocalAuthorityObservations,
			measureObservations,
		},
	});
	if ("status" in numericObservationResult) return numericObservationResult;
	const { observations, records: numericRecords } = numericObservationResult;
	const targetMembers = aggregateTargetMembers({
		records: numericRecords,
		location,
		regional,
		areaCode,
	});
	const locationCoverageResult = validateLocationAggregation({
		location,
		byLocation: targetMembers.byLocation,
		areaLookup,
		sourceGeography: source.sourceGeography,
	});
	if (locationCoverageResult && "status" in locationCoverageResult)
		return locationCoverageResult;
	const locationCoverage = locationCoverageResult;
	const { byCountry, byRegion } = targetMembers;
	/*
	 * A country or region total sums whatever the partition publishes, so a
	 * partition holding values for only some areas, as a local election
	 * does for the wards that went to the polls, still answers. It must
	 * then say so, by comparing what was summed with the areas a matching
	 * boundary release holds. A named location is not assessed here: its
	 * members are reconciled above, and an unexplained gap is refused.
	 */
	const coverage = assessAggregationCoverage({
		byCountry,
		byRegion,
		regional,
		compatibleReleases,
		areaLookup,
		sourceGeography: source.sourceGeography,
		areaCode,
	});
	const aggregateResult = requireAggregateMembers({
		...targetMembers,
		regional,
	});
	if ("status" in aggregateResult) return aggregateResult;
	const aggregate = aggregateResult;
	let aggregateValue = aggregate.value;
	let weighting: AggregateWeighting | undefined;
	if (weightedAggregation) {
		const weightMeasureId = weightedAggregation.weight.measureId;
		if (!weightMeasureId) {
			return problem(
				422,
				"Operation Not Supported",
				"This weighted measure does not publish a weight measure the API can aggregate with.",
				{ code: "aggregation_not_supported" },
			);
		}
		const weightedSource = readWeightedSource({
			context,
			dataCatalog,
			weightMeasureId,
			measureId,
			period: period as string,
			source,
			artifacts: {
				populationObservations,
				populationLocalAuthorityObservations,
				measureObservations,
			},
		});
		if ("status" in weightedSource) return weightedSource;
		const { measure: weightMeasure, source: weightSource } = weightedSource;
		const weightObservations = weightedSource.observations;
		const weightRecords = weightedSource.records;
		const weightedAggregate = calculateWeightedAggregate({
			aggregate,
			weightRecords,
			location,
			regional,
			areaCode: areaCode as string,
		});
		if ("status" in weightedAggregate) return weightedAggregate;
		aggregateValue = weightedAggregate.value;
		weighting = {
			measure: weightMeasure,
			source: weightSource,
			observations: weightObservations,
			total: weightedAggregate.totalWeight,
		};
	}
	return buildAggregateResponse({
		releaseId,
		measure,
		measureId,
		source,
		period: period as string,
		observations,
		aggregateValue,
		aggregate,
		location,
		regional,
		weighting,
		weightDescription: weightedAggregation?.weight.description,
		locationCoverage,
		coverage,
		areaLookup,
		areaCode,
	});
};
