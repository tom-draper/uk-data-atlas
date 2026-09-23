import type { RouteRequest } from "./routing";
import { problem, type ApiResponse } from "./routeResponse";
import { readWeightedSource } from "./weightedSource";
import { calculateWeightedAggregate } from "./weightedAggregation";
import {
	buildAggregateResponse,
	type AggregateWeighting,
} from "./aggregateResponse";
import { parseAggregateQuery } from "./aggregateQuery";
import { readAggregateObservations } from "./aggregateObservations";
import {
	resolveAggregationLocation,
	validateAggregationLocationSource,
} from "./aggregationLocation";
import { resolveAggregationMeasure } from "./aggregationMeasure";
import { resolveAggregationPartition } from "./aggregationPartition";
import { prepareAggregateTarget } from "./aggregatePreparation";

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
		dataCatalog,
		populationObservations,
		populationLocalAuthorityObservations,
		measureObservations,
	} = context;
	const measureId = segments[2] as string;
	const resolvedMeasure = resolveAggregationMeasure({
		dataCatalog,
		measureId,
	});
	if ("status" in resolvedMeasure) return resolvedMeasure;
	const {
		dataCatalog: availableDataCatalog,
		measure,
		weightedAggregation,
	} = resolvedMeasure;
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
	const resolvedLocation = resolveAggregationLocation({
		locationId,
		geographyResolver: context.geographyResolver,
	});
	if (resolvedLocation && "status" in resolvedLocation)
		return resolvedLocation;
	const location = resolvedLocation;
	// The query parser has established these are present; which partition they
	// name is the resolver's to decide.
	const partition = resolveAggregationPartition({
		context,
		measureId,
		period,
		geography,
		boundaryYear,
		targetCode,
		regionCode,
		crosswalkId,
		sourceRelease,
	});
	if ("status" in partition) return partition;
	const { source, compatibleReleases, regional } = partition;
	const locationSourceError = validateAggregationLocationSource({
		location,
		source,
	});
	if (locationSourceError) return locationSourceError;
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
	const preparedAggregate = prepareAggregateTarget({
		records: numericRecords,
		location,
		regional,
		areaCode,
		geographyResolver: context.geographyResolver,
		compatibleReleases,
		sourceGeography: source.sourceGeography,
	});
	if ("status" in preparedAggregate) return preparedAggregate;
	const { aggregate, locationCoverage, coverage } = preparedAggregate;
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
			dataCatalog: availableDataCatalog,
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
		geographyResolver: context.geographyResolver,
		areaCode,
	});
};
