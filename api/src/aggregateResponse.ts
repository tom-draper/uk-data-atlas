import type { GeographyResolver } from "./geographyResolver";
import type { AggregateCoverage, AggregateMembers } from "./aggregation";
import type { AggregationTarget } from "./aggregationTarget";
import type { Measure, MeasureSource } from "./dataCatalog";
import type { LocationCoverage } from "./locationAggregation";
import type { NamedLocation } from "./namedLocations";
import type { ObservationArtifactReference } from "./sourceExactProvenance";
import { envelope, type ApiResponse } from "./routeResponse";
import { sourceExactProvenance } from "./sourceExactProvenance";

export type AggregateWeighting = {
	measure: Measure;
	source: MeasureSource;
	observations: ObservationArtifactReference;
	total: number;
};

/** Build the stable response envelope after an aggregate has been calculated. */
export const buildAggregateResponse = ({
	releaseId,
	measure,
	measureId,
	source,
	period,
	observations,
	aggregateValue,
	aggregate,
	location,
	regional,
	weighting,
	weightDescription,
	locationCoverage,
	coverage,
	geographyResolver,
	areaCode,
}: {
	releaseId: string;
	measure: Measure;
	measureId: string;
	source: MeasureSource;
	period: string;
	observations: ObservationArtifactReference;
	aggregateValue: number;
	aggregate: AggregateMembers;
	location?: NamedLocation;
	regional?: AggregationTarget;
	weighting?: AggregateWeighting;
	weightDescription?: string;
	locationCoverage?: LocationCoverage;
	coverage?: AggregateCoverage;
	geographyResolver: GeographyResolver;
	areaCode: string | null;
}): ApiResponse => {
	const country = location
		? undefined
		: geographyResolver.countryIdentity(areaCode as string);
	const operation = weighting ? "weighted-mean" : "sum";
	const weight = weighting
		? {
				description: weightDescription ?? "",
				total: weighting.total,
			}
		: undefined;
	return {
		status: 200,
		body: envelope(releaseId, {
			measure,
			source,
			period,
			sourceGeography: source.sourceGeography,
			...(location
				? { location }
				: regional
					? {
							target: regional.target,
							// `region` predates `target` and still names a
							// region, so a caller reading it keeps working.
							...(regional.target.geography === "region"
								? { region: regional.target }
								: {}),
						}
					: { area: country }),
			provenance: {
				...sourceExactProvenance({
					atlasRelease: releaseId,
					measure,
					source,
					period,
					observations,
				}),
				transformation: {
					status: "not-applied",
					note: "Input observations are source-exact; no geographic conversion was applied.",
				},
				...(weighting
					? {
							weight: sourceExactProvenance({
								atlasRelease: releaseId,
								measure: weighting.measure,
								source: weighting.source,
								period,
								observations: weighting.observations,
							}),
						}
					: {}),
			},
			aggregation: location
				? {
						operation,
						membership: "direct-code-match",
						inputRecordCount: aggregate.members.length,
						...(weight ? { weight } : {}),
						// Codes the sum passed over are named, so a value is
						// never quietly partial. Those of another vintage
						// have the code that replaced them standing in
						// their place; legacy aliases name no compiled area
						// at all and matched nothing.
						...(locationCoverage &&
						locationCoverage.unresolvedCount > 0
							? {
									memberCodesNotInPartition: {
										otherVintage:
											locationCoverage.unresolved
												.filter(
													(member) =>
														member.status ===
															"superseded" ||
														member.status ===
															"not-yet-current",
												)
												.map((member) => member.code),
										legacyAliases:
											locationCoverage.legacy.map(
												(member) => member.code,
											),
									},
								}
							: {}),
						note: weighting
							? "Every curated location member code that names an area in this partition was found in both the source-exact value and weight partitions."
							: "Every curated location member code that names an area in this partition was found in the published source partition.",
					}
				: regional
					? {
							operation,
							membership: regional.claim,
							inputRecordCount: aggregate.members.length,
							crosswalk: {
								id: regional.crosswalk.id,
								method: regional.crosswalk.method,
								quality: regional.crosswalk.quality,
							},
							...(weight ? { weight } : {}),
							coverage: {
								...coverage,
								note: "Compares the source areas summed with every area the crosswalk places wholly in this region. `partial` means the partition publishes no value for some of them, so the total is not the region's.",
							},
							note: "Regional membership comes from the caller-selected crosswalk; every included local authority is wholly covered by this one region.",
						}
					: {
							operation,
							membership: "gss-country-code",
							inputRecordCount: aggregate.members.length,
							coverage: {
								...coverage,
								href: `/v1/measures/${measureId}/coverage`,
								note: "The sum covers every area of this country published in this source partition. Each assessment compares those areas with the country's areas in a boundary release the partition is assessed to match; `partial` means the release holds areas the partition publishes no value for, so the total is not a national one.",
							},
							...(weight ? { weight } : {}),
							note: weighting
								? "Country membership follows the first character of the GSS area code, and every source-exact value has its published weight."
								: "Country membership follows the first character of the GSS area code, which the coding scheme assigns by country.",
						},
			record: { value: aggregateValue, status: "derived" },
		}),
	};
};
