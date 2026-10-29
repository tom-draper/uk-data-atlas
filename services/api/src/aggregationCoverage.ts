import type { GeographyResolver } from "@uk-data-atlas/atlas-runtime/areas";
import type { MeasureSource } from "@uk-data-atlas/measures";
import {
	assessCoverage,
	countryCodeFor,
	summariseCoverage,
	type AggregateCoverage,
} from "./aggregation";
import type { CompatibilityCandidate } from "@uk-data-atlas/measures";
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
	geographyResolver,
	sourceGeography,
	areaCode,
}: {
	byCountry?: AggregatedMembers;
	byRegion?: AggregatedMembers;
	regional?: AggregationTarget;
	compatibleReleases: CompatibilityCandidate[];
	geographyResolver: GeographyResolver;
	sourceGeography: MeasureSource["sourceGeography"];
	areaCode: string | null;
}): AggregateCoverage | undefined =>
	byCountry
		? summariseCoverage(
				compatibleReleases.flatMap((candidate) => {
					const expected =
						geographyResolver.areaCodes(
							sourceGeography.type,
							candidate.boundaryRelease,
						) ?? [];
					const inCountry = expected.filter(
						(code) => countryCodeFor(code) === areaCode,
					);
					return inCountry.length > 0
						? [
								assessCoverage(
									candidate.boundaryRelease,
									inCountry,
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
