import type { AreaLookup } from "./areaInventory";
import type { CrosswalkArtifact } from "./crosswalkInventory";
import { isNumericObservation, type MeasureSource } from "./dataCatalog";
import { observationsFor } from "./observationArtifacts";
import {
	aggregateCountryMembers,
	aggregateLocationMembers,
	isCountryCode,
	assessCoverage,
	statisticPhrase,
	countryCodeFor,
	summariseCoverage,
} from "./aggregation";
import { reconcileMembersForYear } from "./memberReconciliation";
import {
	sourceExactProvenance,
	type ObservationArtifactReference,
} from "./sourceExactProvenance";
import { findArea } from "./areaResources";
import type { RouteRequest } from "./routing";
import { envelope, problem, type ApiResponse } from "./routeResponse";

/**
 * The canonical identity of a country code, from the newest compiled country
 * release. Countries are stable across releases, so the newest is a safe
 * choice, and the release is reported alongside the name.
 */
const findCountryIdentity = (
	areaLookup: AreaLookup | undefined,
	code: string,
) => {
	const releases = [...(areaLookup?.keys() ?? [])]
		.filter((key) => key.startsWith("country/"))
		.sort()
		.reverse();
	for (const key of releases) {
		const area = areaLookup?.get(key)?.get(code);
		if (area) {
			const boundaryRelease = key.slice("country/".length);
			return {
				id: `country/${boundaryRelease}/${code}`,
				boundaryRelease,
				...area,
			};
		}
	}
	return undefined;
};

/**
 * An area-overlap crosswalk is safe for direct regional membership only when
 * every selected source area is wholly covered by exactly that one region.
 * Split or partial overlaps remain conversion data and are never silently
 * treated as a regional sum.
 */
const fullRegionMembership = (
	crosswalk: CrosswalkArtifact,
	regionCode: string,
) => {
	if (crosswalk.method !== "area-overlap") return undefined;
	const matching = crosswalk.records.filter((record) =>
		record.targets.some((target) => target.code === regionCode),
	);
	const memberCodes = matching.flatMap((record) => {
		const target = record.targets.find(
			(candidate) => candidate.code === regionCode,
		);
		return target &&
			record.targets.length === 1 &&
			record.source.coverage === 1 &&
			target.sourceShare === 1
			? [record.source.code]
			: [];
	});
	return {
		memberCodes,
		unsafeSourceCount: matching.length - memberCodes.length,
	};
};

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
	if (
		parsedUrl.searchParams.has("release") ||
		parsedUrl.searchParams.has("conversion")
	) {
		return problem(
			422,
			"Operation Not Supported",
			"This aggregation does not select a geometry release or convert observations.",
		);
	}
	const period = parsedUrl.searchParams.get("period");
	const geography = parsedUrl.searchParams.get("geography");
	const boundaryYear = parsedUrl.searchParams.get("boundaryYear");
	const locationId = parsedUrl.searchParams.get("locationId");
	const areaCode = parsedUrl.searchParams.get("areaCode");
	const regionCode = parsedUrl.searchParams.get("regionCode");
	if ([locationId, areaCode, regionCode].filter(Boolean).length !== 1) {
		return problem(
			400,
			"Invalid Query",
			"Supply exactly one of locationId, for a curated named location, areaCode, for a country, or regionCode with a regional crosswalk.",
		);
	}
	if (areaCode && !isCountryCode(areaCode)) {
		return problem(
			400,
			"Invalid Query",
			"areaCode currently supports a country code only, such as E92000001. Use locationId for a curated named location.",
		);
	}
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
	const source = measure.sources.find(
		(candidate) =>
			candidate.periods.includes(period ?? "") &&
			candidate.sourceGeography.type === geography &&
			String(candidate.sourceGeography.boundaryYear) === boundaryYear,
	);
	if (!source)
		return problem(
			400,
			"Invalid Query",
			`${measureId} has no published source for that period, geography and boundary year.`,
		);
	// The boundary releases this partition is assessed to match, against
	// which an aggregate's coverage can be judged.
	const compatibleReleases = (
		measureCompatibilityInventory?.measures
			.find((candidate) => candidate.measureId === measureId)
			?.sources.find(
				(candidate) =>
					candidate.datasetId === source.datasetId &&
					candidate.sourceGeography.type ===
						source.sourceGeography.type &&
					candidate.sourceGeography.boundaryYear ===
						source.sourceGeography.boundaryYear &&
					candidate.periods.includes(period as string),
			)?.candidates ?? []
	).filter(
		(candidate) =>
			candidate.status === "exact-code-set" ||
			candidate.status === "code-set-compatible",
	);
	const regional = (() => {
		if (!regionCode) return undefined;
		const crosswalkId = parsedUrl.searchParams.get("crosswalk");
		const sourceRelease = parsedUrl.searchParams.get("sourceRelease");
		if (!crosswalkId || !sourceRelease) {
			return problem(
				400,
				"Invalid Query",
				"regionCode aggregation requires crosswalk and sourceRelease, so regional membership is explicit rather than inferred.",
			);
		}
		if (!crosswalkLookup || !measureCompatibilityInventory) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build crosswalk and measure compatibility inventories before aggregating a region.",
			);
		}
		const compatibility = compatibleReleases.find(
			(candidate) => candidate.boundaryRelease === sourceRelease,
		);
		if (!compatibility) {
			return problem(
				422,
				"Operation Not Supported",
				"The requested sourceRelease is not code-set compatible with this source partition.",
				{ code: "conversion_not_available" },
			);
		}
		const crosswalk = crosswalkLookup.get(crosswalkId);
		if (
			!crosswalk ||
			crosswalk.from.geography !== source.sourceGeography.type ||
			crosswalk.from.boundaryRelease !== sourceRelease ||
			crosswalk.to.geography !== "region"
		) {
			return problem(
				422,
				"Operation Not Supported",
				"That crosswalk does not map the caller-selected compatible source release to regions.",
				{ code: "conversion_not_available" },
			);
		}
		const membership = fullRegionMembership(crosswalk, regionCode);
		if (!membership || membership.unsafeSourceCount > 0) {
			return problem(
				422,
				"Operation Not Supported",
				"The selected region is not represented by complete one-to-one source-area membership in that crosswalk.",
				{ code: "conversion_not_available" },
			);
		}
		return {
			crosswalk,
			sourceRelease,
			memberCodes: new Set(membership.memberCodes),
			region: {
				id: `region/${crosswalk.to.boundaryRelease}/${regionCode}`,
				boundaryRelease: crosswalk.to.boundaryRelease,
				code: regionCode,
				...findArea(
					areaLookup,
					"region",
					crosswalk.to.boundaryRelease,
					regionCode,
				),
			},
		};
	})();
	if (regional && "status" in regional) return regional;
	const observations = observationsFor(measureId, source, period as string, {
		populationObservations,
		populationLocalAuthorityObservations,
		measureObservations,
	});
	if (!observations)
		return problem(
			503,
			"Catalogue Unavailable",
			`The observation artifact for ${measureId} is missing, or does not contain the catalogue's declared source period.`,
		);
	const numericRecords = observations.records.filter(isNumericObservation);
	if (numericRecords.length !== observations.records.length) {
		return problem(
			503,
			"Catalogue Unavailable",
			`The observation artifact for ${measureId} does not contain numeric records required for aggregation.`,
		);
	}
	const byLocation = location
		? aggregateLocationMembers(location, numericRecords)
		: undefined;
	/*
	 * A curated location lists every code it has ever been made of, so
	 * against any one partition some are always the wrong vintage: the
	 * North West carries the six Cumbria districts and the two unitaries
	 * that replaced them, and no release holds both. Refusing on any
	 * unresolved code refused the location outright, for every vintage.
	 *
	 * What must hold is that nothing is missed and nothing counted twice.
	 * A code absent because it is superseded has its successor resolving in
	 * its place, and one not yet current has its predecessor; either way
	 * the ground is covered exactly once, because a release's areas are a
	 * partition and only codes in that release are summed. An absence the
	 * vintage does not explain is still refused.
	 */
	const locationCoverage =
		location && byLocation && areaLookup
			? reconcileMembersForYear(
					areaLookup,
					source.sourceGeography.type,
					source.sourceGeography.boundaryYear,
					location.memberCodes,
					new Set(
						byLocation.members.map((record) => record.areaCode),
					),
				)
			: undefined;
	// Telling a vintage mismatch from a bad code needs the compiled releases
	// to compare against. Without them, fall back to refusing any unresolved
	// code rather than guessing which kind it is.
	if (
		location &&
		byLocation &&
		!areaLookup &&
		byLocation.unresolvedMemberCodes.length > 0
	) {
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the area inventory before aggregating over a named location, so a member code of another vintage can be told from one that is wrong.",
		);
	}
	if (locationCoverage && !locationCoverage.coversLocation) {
		return problem(
			422,
			"Operation Not Supported",
			`The named location does not cover this source partition by direct code match: ${locationCoverage.unexplained
				.map((member) => `${member.code} (${member.status})`)
				.join(", ")}. No conversion or partial sum was applied.`,
			{ code: "partial_coverage" },
		);
	}
	if (byLocation && location && byLocation.members.length === 0) {
		// A country is carried as a map extent with no member codes, and is
		// summed by its own GSS code rather than by membership.
		if (location.memberCodes.length === 0) {
			return problem(
				422,
				"Operation Not Supported",
				`${location.label} carries no member codes: it names an extent rather than a set of areas. Aggregate a country with areaCode, such as areaCode=E92000001 for England.`,
			);
		}
		const resolvedElsewhere = [
			...new Set(
				(locationCoverage?.unresolved ?? []).flatMap(
					(member) => member.presentIn,
				),
			),
		].sort();
		return problem(
			422,
			"Operation Not Supported",
			`Every member code of ${location.label} is the wrong vintage for this source partition, which is on ${source.sourceGeography.boundaryYear} ${source.sourceGeography.type} codes${
				resolvedElsewhere.length > 0
					? `; they resolve against ${resolvedElsewhere.join(", ")}`
					: ""
			}. The place is no longer one of these areas in its own right.`,
		);
	}
	const byCountry =
		location || regional
			? undefined
			: aggregateCountryMembers(areaCode as string, numericRecords);
	const byRegion = regional
		? {
				members: numericRecords.filter((record) =>
					regional.memberCodes.has(record.areaCode),
				),
				value: numericRecords
					.filter((record) =>
						regional.memberCodes.has(record.areaCode),
					)
					.reduce((total, record) => total + record.value, 0),
			}
		: undefined;
	// A country the partition does not reach would otherwise sum to zero,
	// which reads as an observation rather than an absence.
	if (byCountry && byCountry.members.length === 0) {
		return problem(
			422,
			"Operation Not Supported",
			"This source partition publishes no areas for that country, so there is nothing to sum.",
		);
	}
	if (byRegion && byRegion.members.length === 0) {
		return problem(
			422,
			"Operation Not Supported",
			"This source partition publishes no areas for that region, so there is nothing to combine.",
		);
	}
	/*
	 * A country or region total sums whatever the partition publishes, so a
	 * partition holding values for only some areas, as a local election
	 * does for the wards that went to the polls, still answers. It must
	 * then say so, by comparing what was summed with the areas a matching
	 * boundary release holds. A named location is not assessed here: its
	 * members are reconciled above, and an unexplained gap is refused.
	 */
	const coverage = byCountry
		? summariseCoverage(
				compatibleReleases.flatMap((candidate) => {
					const expected = [
						...(areaLookup
							?.get(
								`${source.sourceGeography.type}/${candidate.boundaryRelease}`,
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
	const aggregate = byLocation ?? byCountry ?? byRegion;
	if (!aggregate)
		return problem(
			400,
			"Invalid Query",
			"Supply exactly one of locationId, areaCode or regionCode.",
		);
	let aggregateValue = aggregate.value;
	let weighting:
		| {
				measure: (typeof dataCatalog.measures)[number];
				source: MeasureSource;
				observations: ObservationArtifactReference;
				total: number;
		  }
		| undefined;
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
		const weightMeasure = dataCatalog.measures.find(
			(candidate) => candidate.id === weightMeasureId,
		);
		const weightSource = weightMeasure?.sources.find(
			(candidate) =>
				candidate.periods.includes(period ?? "") &&
				candidate.sourceGeography.type ===
					source.sourceGeography.type &&
				candidate.sourceGeography.boundaryYear ===
					source.sourceGeography.boundaryYear,
		);
		if (!weightMeasure || !weightSource) {
			return problem(
				503,
				"Catalogue Unavailable",
				`No source-exact ${weightMeasureId} partition is available to weight ${measureId}.`,
			);
		}
		const weightObservations = observationsFor(
			weightMeasureId,
			weightSource,
			period as string,
			{
				populationObservations,
				populationLocalAuthorityObservations,
				measureObservations,
			},
		);
		if (!weightObservations) {
			return problem(
				503,
				"Catalogue Unavailable",
				`The weight artifact for ${weightMeasureId} is missing, or does not contain the catalogue's declared source period.`,
			);
		}
		const weightRecords =
			weightObservations.records.filter(isNumericObservation);
		if (weightRecords.length !== weightObservations.records.length) {
			return problem(
				503,
				"Catalogue Unavailable",
				`The weight artifact for ${weightMeasureId} does not contain numeric records.`,
			);
		}
		const weightAggregate = location
			? aggregateLocationMembers(location, weightRecords)
			: regional
				? {
						members: weightRecords.filter((record) =>
							regional.memberCodes.has(record.areaCode),
						),
						value: weightRecords
							.filter((record) =>
								regional.memberCodes.has(record.areaCode),
							)
							.reduce((total, record) => total + record.value, 0),
					}
				: aggregateCountryMembers(areaCode as string, weightRecords);
		const valueCodes = new Set(
			aggregate.members.map((record) => record.areaCode),
		);
		const weightsByCode = new Map(
			weightAggregate.members.map((record) => [record.areaCode, record]),
		);
		if (
			weightAggregate.members.length !== aggregate.members.length ||
			[...valueCodes].some((code) => !weightsByCode.has(code))
		) {
			return problem(
				422,
				"Operation Not Supported",
				"The published value and weight partitions do not cover the same source areas, so no partial weighted mean was calculated.",
				{ code: "partial_coverage" },
			);
		}
		const totalWeight = weightAggregate.members.reduce(
			(total, record) => total + record.value,
			0,
		);
		if (
			!Number.isFinite(totalWeight) ||
			totalWeight <= 0 ||
			weightAggregate.members.some(
				(record) => !Number.isFinite(record.value) || record.value < 0,
			)
		) {
			return problem(
				422,
				"Operation Not Supported",
				"The published weights must be finite, non-negative and sum to more than zero.",
				{ code: "aggregation_not_supported" },
			);
		}
		aggregateValue =
			aggregate.members.reduce(
				(total, record) =>
					total +
					record.value *
						(weightsByCode.get(record.areaCode)?.value ?? 0),
				0,
			) / totalWeight;
		weighting = {
			measure: weightMeasure,
			source: weightSource,
			observations: weightObservations,
			total: totalWeight,
		};
	}
	const country = location
		? undefined
		: findCountryIdentity(areaLookup, areaCode as string);
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
					? { region: regional.region }
					: { area: country }),
			provenance: {
				...sourceExactProvenance({
					atlasRelease: releaseId,
					measure,
					source,
					period: period as string,
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
								period: period as string,
								observations: weighting.observations,
							}),
						}
					: {}),
			},
			aggregation: location
				? {
						operation: weighting ? "weighted-mean" : "sum",
						membership: "direct-code-match",
						inputRecordCount: aggregate.members.length,
						...(weighting
							? {
									weight: {
										description:
											weightedAggregation?.weight
												.description ?? "",
										total: weighting.total,
									},
								}
							: {}),
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
							operation: weighting ? "weighted-mean" : "sum",
							membership: "verified-full-area-overlap",
							inputRecordCount: aggregate.members.length,
							crosswalk: {
								id: regional.crosswalk.id,
								method: regional.crosswalk.method,
								quality: regional.crosswalk.quality,
							},
							...(weighting
								? {
										weight: {
											description:
												weightedAggregation?.weight
													.description ?? "",
											total: weighting.total,
										},
									}
								: {}),
							coverage: {
								...coverage,
								note: "Compares the source areas summed with every area the crosswalk places wholly in this region. `partial` means the partition publishes no value for some of them, so the total is not the region's.",
							},
							note: "Regional membership comes from the caller-selected crosswalk; every included local authority is wholly covered by this one region.",
						}
					: {
							operation: weighting ? "weighted-mean" : "sum",
							membership: "gss-country-code",
							inputRecordCount: aggregate.members.length,
							coverage: {
								...coverage,
								href: `/v1/measures/${measureId}/coverage`,
								note: "The sum covers every area of this country published in this source partition. Each assessment compares those areas with the country's areas in a boundary release the partition is assessed to match; `partial` means the release holds areas the partition publishes no value for, so the total is not a national one.",
							},
							...(weighting
								? {
										weight: {
											description:
												weightedAggregation?.weight
													.description ?? "",
											total: weighting.total,
										},
									}
								: {}),
							note: weighting
								? "Country membership follows the first character of the GSS area code, and every source-exact value has its published weight."
								: "Country membership follows the first character of the GSS area code, which the coding scheme assigns by country.",
						},
			record: { value: aggregateValue, status: "derived" },
		}),
	};
};
