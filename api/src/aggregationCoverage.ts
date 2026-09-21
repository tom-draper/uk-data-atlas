import type { AreaLookup } from "./areaInventory";
import type { MeasureSource } from "./dataCatalog";
import {
	assessCoverage,
	countryCodeFor,
	summariseCoverage,
	type AggregateCoverage,
} from "./aggregation";
import type { CompatibilityCandidate } from "./measureCompatibility";
import type { AggregationTarget } from "./aggregationTarget";

type AggregatedMembers = {
	members: Array<{ areaCode: string }>;
};

/** Assess the completeness evidence attached to a country or target sum. */
export const assessAggregationCoverage = ({
	byCountry,
	byRegion,
	regional,
	compatibleReleases,
	areaLookup,
	sourceGeography,
	areaCode,
}: {
	byCountry?: AggregatedMembers;
	byRegion?: AggregatedMembers;
	regional?: AggregationTarget;
	compatibleReleases: CompatibilityCandidate[];
	areaLookup?: AreaLookup;
	sourceGeography: MeasureSource["sourceGeography"];
	areaCode: string | null;
}): AggregateCoverage | undefined =>
	byCountry
		? summariseCoverage(
				compatibleReleases.flatMap((candidate) => {
					const expected = [
						...(areaLookup
							?.get(
								`${sourceGeography.type}/${candidate.boundaryRelease}`,
							)
							?.keys() ?? []),
					].filter((code) => countryCodeFor(code) === areaCode);
					return expected.length > 0
						? [
								assessCoverage(
									candidate.boundaryRelease,
									expected,
									new Set(
										byCountry.members.map(
											(record) => record.areaCode,
										),
									),
								),
							]
						: [];
				}),
				"No compiled boundary release is assessed as a matching code set for this source partition, so the areas it should hold for this country are not known.",
			)
		: byRegion && regional
			? summariseCoverage(
					[
						assessCoverage(
							regional.sourceRelease,
							regional.memberCodes,
							new Set(
								byRegion.members.map(
									(record) => record.areaCode,
								),
							),
						),
					],
					"",
				)
			: undefined;
