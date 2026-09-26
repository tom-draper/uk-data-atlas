import type { Features, PropertyKeys } from "@/lib/types";
import { getFeatureProp } from "@/lib/types";
import type {
	AggregatedBroadbandData,
	BroadbandDataset,
} from "@/lib/types/broadband";
import type {
	AggregatedAirQualityData,
	AirQualityDataset,
} from "@/lib/types/airQuality";
import type {
	AggregatedClaimantCountData,
	ClaimantCountDataset,
} from "@/lib/types/claimantCount";
import type {
	AggregatedChildPovertyData,
	ChildPovertyDataset,
} from "@/lib/types/childPoverty";
import type {
	AggregatedHomelessnessData,
	HomelessnessDataset,
} from "@/lib/types/homelessness";
import type {
	AggregatedFuelPovertyData,
	FuelPovertyDataset,
} from "@/lib/types/fuelPoverty";
import type {
	AggregatedGhgEmissionsData,
	GhgEmissionsDataset,
} from "@/lib/types/ghgEmissions";
import type {
	AggregatedMobileCoverageData,
	MobileCoverageDataset,
} from "@/lib/types/mobileCoverage";
import type {
	AggregatedSchoolPerformanceData,
	AggregatedSchoolPerformanceGapData,
	SchoolPerformanceGapMeasures,
	SchoolPerformanceMeasures,
} from "@/lib/types/schoolPerformance";

/** Collects the numeric dataset records represented by the active boundaries. */
export function collectBoundaryRecords<T>(
	features: Features,
	data: Record<string, T>,
	codeProperty: PropertyKeys,
): T[] {
	const records: T[] = [];
	for (const feature of features) {
		const record =
			data[getFeatureProp(feature.properties, codeProperty) ?? ""];
		if (record) records.push(record);
	}
	return records;
}

/**
 * The mean of a value over records, each weighted by the size of the
 * population it describes, over the records that have both. A figure that is
 * a share or an average of something must be combined this way: a flat mean
 * of authorities' figures would weigh the Isles of Scilly as heavily as
 * Birmingham.
 */
export function weightedMean<T>(
	records: T[],
	value: (record: T) => number | null | undefined,
	weight: (record: T) => number | null | undefined,
): number | null {
	let weighted = 0,
		total = 0;
	for (const record of records) {
		const v = value(record);
		const w = weight(record);
		if (v == null || w == null || !(w > 0)) continue;
		weighted += v * w;
		total += w;
	}
	return total > 0 ? weighted / total : null;
}

/**
 * The size of the population a rate is taken over, recovered from a count and
 * the rate it gives: 250 claimants at 2.5% are 10,000 residents. Unknown where
 * the rate is zero, since any population gives none.
 */
const denominator = (count: number, ratePer: number, rate: number) =>
	rate > 0 ? (count / rate) * ratePer : null;

/** Coverage is a share of premises, so authorities are weighted by premises. */
export function aggregateBroadband(
	records: BroadbandDataset["data"][string][],
): AggregatedBroadbandData | null {
	const reporting = records.filter((record) => record.pctFullFibre != null);
	const share = (
		field: "pctSuperfast" | "pctUltrafast" | "pctFullFibre" | "pctGigabit",
	) =>
		weightedMean(
			reporting,
			(record) => record[field],
			(record) => record.premisesCount,
		) ?? 0;
	return reporting.some((record) => (record.premisesCount ?? 0) > 0)
		? {
				pctSuperfast: share("pctSuperfast"),
				pctUltrafast: share("pctUltrafast"),
				pctFullFibre: share("pctFullFibre"),
				pctGigabit: share("pctGigabit"),
			}
		: null;
}

/**
 * Each authority's concentration is a mean over its 1x1 km grid cells, so
 * weighting by cell count gives the mean over every cell in the combined area.
 */
export function aggregateAirQuality(
	records: AirQualityDataset["data"][string][],
): AggregatedAirQualityData | null {
	const cells = (record: AirQualityDataset["data"][string]) =>
		record.gridCells;
	const no2Mean = weightedMean(records, (record) => record.no2Mean, cells);
	return no2Mean === null
		? null
		: {
				no2Mean,
				pm25Mean: weightedMean(
					records,
					(record) => record.pm25Mean,
					cells,
				),
				pm10Mean: weightedMean(
					records,
					(record) => record.pm10Mean,
					cells,
				),
			};
}

/**
 * Counts add. Both rates are claimants as a share of residents aged 16 to 64,
 * so the combined rate is the summed claimants over the summed residents,
 * recovered from each authority's count and rate.
 */
export function aggregateClaimantCount(
	records: ClaimantCountDataset["data"][string][],
): AggregatedClaimantCountData | null {
	if (records.length === 0) return null;
	let totalCount = 0,
		youthCount = 0,
		residents = 0,
		ratedTotal = 0,
		ratedYouth = 0;
	for (const record of records) {
		totalCount += record.totalCount;
		youthCount += record.youthCount;
		const population = denominator(
			record.totalCount,
			100,
			record.totalRate,
		);
		if (population === null) continue;
		residents += population;
		ratedTotal += record.totalCount;
		ratedYouth += record.youthCount;
	}
	return {
		totalCount,
		totalRate: residents > 0 ? (ratedTotal / residents) * 100 : 0,
		youthCount,
		youthRate: residents > 0 ? (ratedYouth / residents) * 100 : 0,
	};
}

export function aggregateChildPoverty(
	records: ChildPovertyDataset["data"][string][],
): AggregatedChildPovertyData | null {
	let childCount = 0,
		childrenPopulation = 0,
		count = 0;
	for (const record of records) {
		childCount += record.childCount;
		childrenPopulation += record.childrenPopulation;
		count++;
	}
	return count === 0 || childrenPopulation === 0
		? null
		: {
				childCount,
				childPovertyRate: (childCount / childrenPopulation) * 100,
			};
}

/**
 * Emissions are a count, so they add across authorities; the per-person figure
 * has to be recomputed from the summed population rather than averaged, or a
 * rural authority with few residents would weigh as heavily as a city.
 */
export function aggregateGhgEmissions(
	records: GhgEmissionsDataset["data"][string][],
): AggregatedGhgEmissionsData | null {
	let totalKtCO2e = 0,
		excludingLandUseKtCO2e = 0,
		populationThousands = 0,
		transport = 0,
		domestic = 0,
		industry = 0,
		count = 0;
	for (const record of records) {
		totalKtCO2e += record.totalKtCO2e;
		excludingLandUseKtCO2e += record.excludingLandUseKtCO2e;
		populationThousands += record.populationThousands;
		transport += record.transport;
		domestic += record.domestic;
		industry += record.industry;
		count++;
	}
	return count === 0
		? null
		: {
				totalKtCO2e,
				excludingLandUseKtCO2e,
				perPersonTCO2e:
					populationThousands > 0
						? totalKtCO2e / populationThousands
						: 0,
				transport,
				domestic,
				industry,
			};
}

/**
 * Coverage is a share of premises, so authorities are weighted by how many
 * premises they hold rather than averaged flat; otherwise the Isles of Scilly
 * would pull a region's figure as hard as Birmingham. Landmass shares have no
 * premises weight to use, so they stay a plain mean.
 */
export function aggregateMobileCoverage(
	records: MobileCoverageDataset["data"][string][],
): AggregatedMobileCoverageData | null {
	if (records.length === 0) return null;

	const premisesWeighted = (
		field:
			| "pct4GIndoorAll"
			| "pct4GIndoorAny"
			| "pct5GOutdoorAll"
			| "pct5GOutdoorAny",
	) => {
		let weighted = 0,
			premises = 0;
		for (const record of records) {
			const share = record[field];
			const count = record.premisesCount;
			if (share === null || count === null || count <= 0) continue;
			weighted += share * count;
			premises += count;
		}
		return premises > 0 ? weighted / premises : null;
	};

	const mean = (field: "pct4GGeoAll" | "pct5GGeoAny") => {
		let total = 0,
			count = 0;
		for (const record of records) {
			const share = record[field];
			if (share === null) continue;
			total += share;
			count++;
		}
		return count > 0 ? total / count : null;
	};

	return {
		pct4GIndoorAll: premisesWeighted("pct4GIndoorAll"),
		pct4GIndoorAny: premisesWeighted("pct4GIndoorAny"),
		pct5GOutdoorAll: premisesWeighted("pct5GOutdoorAll"),
		pct5GOutdoorAny: premisesWeighted("pct5GOutdoorAny"),
		pct4GGeoAll: mean("pct4GGeoAll"),
		pct5GGeoAny: mean("pct5GGeoAny"),
	};
}

export function aggregateHomelessness(
	records: HomelessnessDataset["data"][string][],
): AggregatedHomelessnessData | null {
	if (records.length === 0) return null;
	let householdsInTemporaryAccommodation = 0;
	let householdsWithChildren = 0;
	let childrenInTemporaryAccommodation = 0;
	// The rate is per thousand of all households in the authority, so the
	// combined rate pools those households, recovered from the count and rate.
	let households = 0;
	let ratedInTemporaryAccommodation = 0;
	for (const record of records) {
		householdsInTemporaryAccommodation +=
			record.householdsInTemporaryAccommodation;
		householdsWithChildren += record.householdsWithChildren;
		childrenInTemporaryAccommodation +=
			record.childrenInTemporaryAccommodation;
		const all = denominator(
			record.householdsInTemporaryAccommodation,
			1000,
			record.householdsPerThousand,
		);
		if (all === null) continue;
		households += all;
		ratedInTemporaryAccommodation +=
			record.householdsInTemporaryAccommodation;
	}
	return {
		householdsInTemporaryAccommodation,
		householdsPerThousand:
			households > 0
				? (ratedInTemporaryAccommodation / households) * 1000
				: 0,
		householdsWithChildren,
		childrenInTemporaryAccommodation,
	};
}

export function aggregateFuelPoverty(
	records: FuelPovertyDataset["data"][string][],
): AggregatedFuelPovertyData | null {
	let householdCount = 0;
	let fuelPoorHouseholdCount = 0;
	for (const record of records) {
		householdCount += record.householdCount;
		fuelPoorHouseholdCount += record.fuelPoorHouseholdCount;
	}
	return householdCount === 0
		? null
		: {
				householdCount,
				fuelPoorHouseholdCount,
				fuelPovertyRate:
					(fuelPoorHouseholdCount / householdCount) * 100,
			};
}

/**
 * Pools each group's Attainment 8 over its own pupils, and takes the gap
 * between the pooled scores. Districts whose cohorts fell below the reporting
 * floor carry a null gap and are skipped, so a region is summarised from the
 * districts that could be measured rather than dragged toward zero.
 */
export function aggregateSchoolPerformanceGap(
	records: SchoolPerformanceGapMeasures[],
): AggregatedSchoolPerformanceGapData | null {
	const measured = records.filter((record) => record.att8Gap != null);
	const att8Disadvantaged = weightedMean(
		measured,
		(record) => record.att8Disadvantaged,
		(record) => record.disadvantagedPupils,
	);
	const att8NotDisadvantaged = weightedMean(
		measured,
		(record) => record.att8NotDisadvantaged,
		(record) => record.notDisadvantagedPupils,
	);
	return att8Disadvantaged === null || att8NotDisadvantaged === null
		? null
		: {
				att8Gap: att8NotDisadvantaged - att8Disadvantaged,
				att8Disadvantaged,
				att8NotDisadvantaged,
			};
}

// Reads only the headline measures, so it serves both the local authority
// district and the parliamentary constituency datasets.
export function aggregateSchoolPerformance(
	records: SchoolPerformanceMeasures[],
): AggregatedSchoolPerformanceData | null {
	// Each figure is a share or an average over the area's pupils, so
	// authorities count by how many pupils they have.
	const reporting = records.filter((record) => record.ptL2basics94 != null);
	const pupils = (record: SchoolPerformanceMeasures) => record.pupils;
	const ptL2basics94 = weightedMean(
		reporting,
		(record) => record.ptL2basics94,
		pupils,
	);
	return ptL2basics94 === null
		? null
		: {
				ptL2basics94,
				ptL2basics95: weightedMean(
					reporting,
					(record) => record.ptL2basics95,
					pupils,
				),
				avgAtt8: weightedMean(
					reporting,
					(record) => record.avgAtt8,
					pupils,
				),
				avgP8score: weightedMean(
					reporting,
					(record) => record.avgP8score,
					pupils,
				),
			};
}
