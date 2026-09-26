import { assessAggregationCoverage } from "./aggregationCoverage";
import type { AggregateCoverage, AggregateMembers } from "./aggregation";
import type { AggregationTarget } from "./aggregationTarget";
import type { GeographyResolver } from "./geographyResolver";
import type { MeasureSource } from "./dataCatalog";
import {
	aggregateTargetMembers,
	requireAggregateMembers,
} from "./aggregateTargetMembers";
import { validateLocationAggregation } from "./locationAggregation";
import type { LocationCoverage } from "./locationAggregation";
import type { CompatibilityCandidate } from "./measureCompatibility";
import type { NamedLocation } from "./namedLocations";
import type { PopulationObservation } from "./dataCatalog";
import { type ApiResponse } from "./routeResponse";

export type PreparedAggregate = {
	aggregate: AggregateMembers;
	locationCoverage?: LocationCoverage;
	coverage?: AggregateCoverage;
};

/** Prepare target membership, vintage reconciliation, and coverage evidence. */
export const prepareAggregateTarget = ({
	records,
	location,
	regional,
	areaCode,
	geographyResolver,
	compatibleReleases,
	sourceGeography,
}: {
	records: PopulationObservation[];
	location?: NamedLocation;
	regional?: AggregationTarget;
	areaCode: string | null;
	geographyResolver: GeographyResolver;
	compatibleReleases: CompatibilityCandidate[];
	sourceGeography: MeasureSource["sourceGeography"];
}): PreparedAggregate | ApiResponse => {
	const targetMembers = aggregateTargetMembers({
		records,
		location,
		regional,
		areaCode,
	});
	const locationCoverageResult = validateLocationAggregation({
		location,
		byLocation: targetMembers.byLocation,
		geographyResolver,
		sourceGeography,
	});
	if (locationCoverageResult && "status" in locationCoverageResult)
		return locationCoverageResult;
	const coverage = assessAggregationCoverage({
		byCountry: targetMembers.byCountry,
		byRegion: targetMembers.byRegion,
		regional,
		compatibleReleases,
		geographyResolver,
		sourceGeography,
		areaCode,
	});
	const aggregateResult = requireAggregateMembers({
		...targetMembers,
		regional,
	});
	if ("status" in aggregateResult) return aggregateResult;
	return {
		aggregate: aggregateResult,
		locationCoverage: locationCoverageResult,
		coverage,
	};
};
