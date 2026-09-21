import { assessAggregationCoverage } from "./aggregationCoverage";
import type { AggregateCoverage, AggregateMembers } from "./aggregation";
import type { AggregationTarget } from "./aggregationTarget";
import type { AreaLookup } from "./areaInventory";
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
	areaLookup,
	compatibleReleases,
	sourceGeography,
}: {
	records: PopulationObservation[];
	location?: NamedLocation;
	regional?: AggregationTarget;
	areaCode: string | null;
	areaLookup?: AreaLookup;
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
		areaLookup,
		sourceGeography,
	});
	if (locationCoverageResult && "status" in locationCoverageResult)
		return locationCoverageResult;
	const coverage = assessAggregationCoverage({
		byCountry: targetMembers.byCountry,
		byRegion: targetMembers.byRegion,
		regional,
		compatibleReleases,
		areaLookup,
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
