import {
	aggregateCountryMembers,
	aggregateLocationMembers,
	type AggregateMembers,
} from "./aggregation";
import type { AggregationTarget } from "./aggregationTarget";
import type { PopulationObservation } from "./dataCatalog";
import type { NamedLocation } from "./namedLocations";
import { problem, type ApiResponse } from "./routeResponse";

export type AggregateTargetMembers = {
	byLocation?: ReturnType<typeof aggregateLocationMembers>;
	byCountry?: ReturnType<typeof aggregateCountryMembers>;
	byRegion?: AggregateMembers;
	aggregate?: AggregateMembers;
};

/** Sum records over the one target selected by the caller. */
export const aggregateRecordsForTarget = ({
	records,
	location,
	regional,
	areaCode,
}: {
	records: PopulationObservation[];
	location?: NamedLocation;
	regional?: AggregationTarget;
	areaCode?: string;
}): AggregateMembers | undefined => {
	if (location) return aggregateLocationMembers(location, records);
	if (regional) {
		const members = records.filter((record) =>
			regional.memberCodes.has(record.areaCode),
		);
		return {
			members,
			value: members.reduce((total, record) => total + record.value, 0),
		};
	}
	return areaCode ? aggregateCountryMembers(areaCode, records) : undefined;
};

/** Build all target views needed for coverage and the final response. */
export const aggregateTargetMembers = ({
	records,
	location,
	regional,
	areaCode,
}: {
	records: PopulationObservation[];
	location?: NamedLocation;
	regional?: AggregationTarget;
	areaCode: string | null;
}): AggregateTargetMembers => {
	const byLocation = location
		? aggregateLocationMembers(location, records)
		: undefined;
	const byCountry =
		location || regional || !areaCode
			? undefined
			: aggregateCountryMembers(areaCode, records);
	const byRegion = regional
		? aggregateRecordsForTarget({ regional, records })
		: undefined;
	return {
		byLocation,
		byCountry,
		byRegion,
		aggregate: byLocation ?? byCountry ?? byRegion,
	};
};

/** Refuse an aggregate whose selected partition has no member records. */
export const requireAggregateMembers = ({
	byCountry,
	byRegion,
	regional,
	aggregate,
}: AggregateTargetMembers & {
	regional?: AggregationTarget;
}): AggregateMembers | ApiResponse => {
	if (byCountry && byCountry.members.length === 0) {
		return problem(
			422,
			"Operation Not Supported",
			"This source partition publishes no areas for that country, so there is nothing to sum.",
		);
	}
	if (byRegion && regional && byRegion.members.length === 0) {
		return problem(
			422,
			"Operation Not Supported",
			`This source partition publishes no areas for that ${regional.target.geography}, so there is nothing to combine.`,
		);
	}
	if (!aggregate) {
		return problem(
			400,
			"Invalid Query",
			"Supply exactly one of locationId, areaCode or targetCode.",
		);
	}
	return aggregate;
};
