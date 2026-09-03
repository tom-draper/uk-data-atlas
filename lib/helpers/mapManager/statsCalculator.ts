// lib/utils/mapManager/statsCalculator.ts
import {
	BoundaryGeojson,
	LocalElectionDataset,
	GeneralElectionDataset,
	PopulationDataset,
	WardStats,
	ConstituencyStats,
	AgeGroups,
	HousePriceWardData,
	AggregatedHousePriceData,
	PopulationStats,
	CrimeDataset,
	AggregatedCrimeData,
	AggregatedIncomeData,
	AggregatedCustomData,
	EthnicityDataset,
	EthnicityCategory,
	getFeatureProp,
	BrexitLADDataset,
	BrexitConstituencyDataset,
	AggregatedBrexitData,
} from "@lib/types";
import { calculateTotal, polygonAreaSqKm } from "../population";
import { getWinningParty } from "../generalElection";
import { calculateAgeGroups } from "../ageDistribution";
import { PropertyDetector } from "./propertyDetector";
import { StatsCache } from "./statsCache";
import {
	aggregateAirQuality,
	aggregateBroadband,
	aggregateChildPoverty,
	aggregateClaimantCount,
	aggregateFuelPoverty,
	aggregateHomelessness,
	aggregateSchoolPerformance,
	collectBoundaryRecords,
} from "../datasetAggregation/numeric";
import { IncomeDataset } from "@/lib/types/income";
import { IMDDataset, AggregatedIMDData } from "@/lib/types/imd";
import { SIMDDataset, AggregatedSIMDData } from "@/lib/types/simd";
import { WIMDDataset, AggregatedWIMDData } from "@/lib/types/wimd";
import { NIMDMDataset, AggregatedNIMDMData } from "@/lib/types/nimdm";
import {
	LifeExpectancyDataset,
	AggregatedLifeExpectancyData,
} from "@/lib/types/lifeExpectancy";
import {
	QualificationDataset,
	AggregatedQualificationData,
	QualificationBreakdown,
} from "@/lib/types/qualification";
import { BroadbandDataset, AggregatedBroadbandData } from "@/lib/types/broadband";
import { AirQualityDataset, AggregatedAirQualityData } from "@/lib/types/airQuality";
import { ClaimantCountDataset, AggregatedClaimantCountData } from "@/lib/types/claimantCount";
import { SchoolPerformanceDataset, AggregatedSchoolPerformanceData } from "@/lib/types/schoolPerformance";
import { NHSWaitingDataset, AggregatedNHSWaitingData } from "@/lib/types/nhsWaiting";
import { UnemploymentDataset, AggregatedUnemploymentData } from "@/lib/types/unemployment";
import { ChildPovertyDataset, AggregatedChildPovertyData } from "@/lib/types/childPoverty";
import { HomelessnessDataset, AggregatedHomelessnessData } from "@/lib/types/homelessness";
import { FuelPovertyDataset, AggregatedFuelPovertyData } from "@/lib/types/fuelPoverty";

const PARTY_KEYS = [
	"LAB",
	"CON",
	"LD",
	"GREEN",
	"RUK",
	"UKIP",
	"BRX",
	"SNP",
	"PC",
	"DUP",
	"SF",
	"SDLP",
	"UUP",
	"APNI",
	"OTHER",
];

// Pre-computed decay weights for age 90+ distribution
const AGE_90_WEIGHTS = (() => {
	const decayRate = 0.15;
	const weights = Array.from({ length: 10 }, (_, i) =>
		Math.exp(-decayRate * i),
	);
	const totalWeight = weights.reduce((sum, w) => sum + w, 0);
	return weights.map((w) => w / totalWeight);
})();

/** Aggregates dataset records against the currently loaded boundary geometry. */
export class DatasetAggregator {
	constructor(
		private propertyDetector: PropertyDetector,
		private cache: StatsCache,
	) {}

	// Wraps a computation in the shared stats cache. Caching the computed value
	// (including null) means empty-coverage results aren't recomputed each update.
	private cached<R>(cacheKey: string, compute: () => R): R {
		const cached = this.cache.get(cacheKey);
		if (cached !== undefined) return cached as R;
		const result = compute();
		this.cache.set(cacheKey, result);
		return result;
	}

	private calculateNumericStats<T, R>(
		cachePrefix: string,
		geojson: BoundaryGeojson,
		data: Record<string, T>,
		location: string | null,
		datasetId: string | null,
		codeLevel: "localAuthority" | "lsoa",
		aggregate: (records: T[]) => R | null,
	): R | null {
		return this.cached(`${cachePrefix}-${location}-${datasetId}`, () => {
			const codeProp = codeLevel === "lsoa"
				? this.propertyDetector.detectLSOACode(geojson.features)
				: this.propertyDetector.detectLocalAuthorityCode(geojson.features);
			return aggregate(collectBoundaryRecords(geojson.features, data, codeProp));
		});
	}

	calculateLocalElectionStats(
		geojson: BoundaryGeojson,
		wardData: LocalElectionDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		return this.cached(`local-election-${location}-${datasetId}`, () => {
			const wardCodeProp = this.propertyDetector.detectWardCode(
				geojson.features,
			);
			const features = geojson.features;

			const stats: WardStats = {
				partyVotes: {
					LAB: 0,
					CON: 0,
					LD: 0,
					GREEN: 0,
					REF: 0,
					IND: 0,
					DUP: 0,
					PC: 0,
					SNP: 0,
					SF: 0,
					APNI: 0,
					SDLP: 0,
				},
				electorate: 0,
				totalVotes: 0,
			};

			// Single pass aggregation with direct property access
			const sv = stats.partyVotes;
			for (let i = 0; i < features.length; i++) {
				const ward =
					wardData[
						getFeatureProp(features[i].properties, wardCodeProp) ?? ""
					];
				if (!ward) continue;

				const pv = ward.partyVotes;
				sv.LAB = (sv.LAB ?? 0) + (pv.LAB ?? 0);
				sv.CON = (sv.CON ?? 0) + (pv.CON ?? 0);
				sv.LD = (sv.LD ?? 0) + (pv.LD ?? 0);
				sv.GREEN = (sv.GREEN ?? 0) + (pv.GREEN ?? 0);
				sv.REF = (sv.REF ?? 0) + (pv.REF ?? 0);
				sv.IND = (sv.IND ?? 0) + (pv.IND ?? 0);
				sv.DUP = (sv.DUP ?? 0) + (pv.DUP ?? 0);
				sv.PC = (sv.PC ?? 0) + (pv.PC ?? 0);
				sv.SNP = (sv.SNP ?? 0) + (pv.SNP ?? 0);
				sv.SF = (sv.SF ?? 0) + (pv.SF ?? 0);
				sv.APNI = (sv.APNI ?? 0) + (pv.APNI ?? 0);
				sv.SDLP = (sv.SDLP ?? 0) + (pv.SDLP ?? 0);

				stats.electorate += ward.electorate;
				stats.totalVotes += ward.totalVotes;
			}

			return stats;
		});
	}

	calculateGeneralElectionStats(
		geojson: BoundaryGeojson,
		constituencyData: GeneralElectionDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		return this.cached(`general-election-${location}-${datasetId}`, () => {
			const constituencyCodeProp =
				this.propertyDetector.detectConstituencyCode(geojson.features);
			const features = geojson.features;

			const stats: ConstituencyStats = {
				totalSeats: 0,
				electorate: 0,
				validVotes: 0,
				invalidVotes: 0,
				partySeats: {},
				totalVotes: 0,
				partyVotes: {},
			};

			for (let i = 0; i < features.length; i++) {
				const constituency =
					constituencyData[
						getFeatureProp(
							features[i].properties,
							constituencyCodeProp,
						) ?? ""
					];
				if (!constituency) continue;

				stats.totalSeats++;
				stats.electorate += constituency.electorate;
				stats.validVotes += constituency.validVotes;
				stats.invalidVotes += constituency.invalidVotes;

				const winningParty = getWinningParty(constituency);
				if (winningParty) {
					stats.partySeats[winningParty] =
						(stats.partySeats[winningParty] || 0) + 1;
				}

				const pv = constituency.partyVotes;
				const spv = stats.partyVotes;
				for (let j = 0; j < PARTY_KEYS.length; j++) {
					const party = PARTY_KEYS[j];
					const votes = pv[party] ?? 0;
					if (votes > 0) {
						stats.totalVotes += votes;
						spv[party] = (spv[party] ?? 0) + votes;
					}
				}
			}

			return stats;
		});
	}

	calculatePopulationStats(
		geojson: BoundaryGeojson,
		populationData: PopulationDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		return this.cached(`population-${location}-${datasetId}`, () => {
			const wardCodeProp = this.propertyDetector.detectWardCode(
				geojson.features,
			);
			const aggregated = this.aggregatePopulationData(
				geojson,
				populationData,
				wardCodeProp,
			);
			return this.buildPopulationStatsResult(aggregated);
		});
	}

	calculateEthnicityStats(
		geojson: BoundaryGeojson,
		localAuthorityData: EthnicityDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		return this.cached(`ethnicity-${location}-${datasetId}`, () => {
			const ladProp = this.propertyDetector.detectLocalAuthorityCode(
				geojson.features,
			);
			const features = geojson.features;

			// Aggregate all ethnicity data across all features
			const aggregated: Record<
				string,
				Record<string, { population: number; code: string }>
			> = {};

			for (let i = 0; i < features.length; i++) {
				const localAuthority =
					localAuthorityData[
						getFeatureProp(features[i].properties, ladProp) ?? ""
					];
				if (!localAuthority) continue;

				// Iterate through parent categories
				for (const [parentCategory, subcategories] of Object.entries(
					localAuthority,
				)) {
					// Initialize parent category if not exists
					if (!aggregated[parentCategory]) {
						aggregated[parentCategory] = {};
					}

					// Iterate through subcategories
					for (const [subcategoryName, ethnicity] of Object.entries(
						subcategories,
					)) {
						// Initialize subcategory if not exists
						if (!aggregated[parentCategory][subcategoryName]) {
							aggregated[parentCategory][subcategoryName] = {
								population: 0,
								code: ethnicity.code,
							};
						}

						// Add population
						aggregated[parentCategory][subcategoryName].population +=
							ethnicity.population;
					}
				}
			}

			// Convert to the format with ethnicity property
			const result: Record<string, EthnicityCategory> = {};

			for (const [parentCategory, subcategories] of Object.entries(
				aggregated,
			)) {
				result[parentCategory] = {};

				for (const [subcategoryName, data] of Object.entries(
					subcategories,
				)) {
					result[parentCategory][subcategoryName] = {
						ethnicity: subcategoryName,
						population: data.population,
						code: data.code,
					};
				}
			}

			return result;
		});
	}

	calculateHousePriceStats(
		geojson: BoundaryGeojson,
		wardData: Record<string, HousePriceWardData>,
		location: string | null,
		datasetId: string | null,
	) {
		return this.cached(`house-price-${location}-${datasetId}`, () => {
			const wardCodeProp = this.propertyDetector.detectWardCode(
				geojson.features,
			);
			const features = geojson.features;

			const yearlyTotals: Record<number, number> = {};
			const yearlyCounts: Record<number, number> = {};
			let totalPrice = 0;
			let wardCount = 0;

			for (let i = 0; i < features.length; i++) {
				const ward =
					wardData[
						getFeatureProp(features[i].properties, wardCodeProp) ?? ""
					];
				if (!ward) continue;

				const prices = ward.prices;
				const price2023 = prices[2023];

				if (price2023 !== null && price2023 !== undefined) {
					totalPrice += price2023;
					wardCount++;
				}

				// Use Object.keys for better performance with small objects
				const years = Object.keys(prices);
				for (let j = 0; j < years.length; j++) {
					const yearNum = Number(years[j]);
					const price = prices[yearNum];
					if (price !== null && yearNum <= 2023) {
						yearlyTotals[yearNum] =
							(yearlyTotals[yearNum] || 0) + price;
						yearlyCounts[yearNum] = (yearlyCounts[yearNum] || 0) + 1;
					}
				}
			}

			const averagePrices: Record<number, number> = {};
			const yearKeys = Object.keys(yearlyTotals);
			for (let i = 0; i < yearKeys.length; i++) {
				const yearNum = Number(yearKeys[i]);
				averagePrices[yearNum] =
					yearlyTotals[yearNum] / yearlyCounts[yearNum];
			}

			const result: AggregatedHousePriceData = {
				averagePrice: wardCount > 0 ? totalPrice / wardCount : 0,
				wardCount,
				averagePrices,
			};
			return result;
		});
	}

	calculateCrimeStats(
		geojson: BoundaryGeojson,
		crimeData: CrimeDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		return this.cached(`crime-${location}-${datasetId}`, () => {
			const ladCodeProp = this.propertyDetector.detectLocalAuthorityCode(
				geojson.features,
			);
			const features = geojson.features;

			let totalRecordedCrime = 0;
			let localAuthorityCount = 0;

			for (let i = 0; i < features.length; i++) {
				const area =
					crimeData[
						getFeatureProp(features[i].properties, ladCodeProp) ?? ""
					];
				if (!area) continue;

				const crime = area.totalRecordedCrime;
				if (crime !== null && crime !== undefined) {
					totalRecordedCrime += crime;
					localAuthorityCount++;
				}
			}

			const result: AggregatedCrimeData = {
				averageRecordedCrime:
					localAuthorityCount > 0
						? totalRecordedCrime / localAuthorityCount
						: 0,
			};
			return result;
		});
	}

	calculateIncomeStats(
		geojson: BoundaryGeojson,
		incomeData: IncomeDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		return this.cached(`income-${location}-${datasetId}`, () => {
			const ladCodeProp = this.propertyDetector.detectLocalAuthorityCode(
				geojson.features,
			);
			const features = geojson.features;

			let totalMedianIncome = 0;
			let localAuthorityCount = 0;

			for (let i = 0; i < features.length; i++) {
				const locationIncome =
					incomeData[
						getFeatureProp(features[i].properties, ladCodeProp) ?? ""
					];
				if (locationIncome?.annual?.median != null) {
					totalMedianIncome += locationIncome.annual.median;
					localAuthorityCount++;
				}
			}

			const result: AggregatedIncomeData = {
				averageIncome:
					localAuthorityCount > 0
						? totalMedianIncome / localAuthorityCount
						: 0,
			};
			return result;
		});
	}

	calculateBrexitStats(
		geojson: BoundaryGeojson,
		brexitData: BrexitLADDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		return this.cached(`brexit-${location}-${datasetId}`, () => {
			const ladCodeProp = this.propertyDetector.detectLocalAuthorityCode(
				geojson.features,
			);
			const features = geojson.features;

			let totalLeave = 0;
			let totalRemain = 0;
			let totalVotes = 0;
			let totalElectorate = 0;

			for (let i = 0; i < features.length; i++) {
				const area =
					brexitData[
						getFeatureProp(features[i].properties, ladCodeProp) ?? ""
					];
				if (!area) continue;

				totalLeave += area.leave;
				totalRemain += area.remain;
				totalVotes += area.validVotes;
				totalElectorate += area.electorate;
			}

			const result: AggregatedBrexitData = {
				totalLeave,
				totalRemain,
				totalVotes,
				pctLeave: totalVotes > 0 ? (totalLeave / totalVotes) * 100 : 0,
				pctRemain: totalVotes > 0 ? (totalRemain / totalVotes) * 100 : 0,
				electorate: totalElectorate,
			};
			return result;
		});
	}

	calculateBrexitConstituencyStats(
		geojson: BoundaryGeojson,
		constituencyData: BrexitConstituencyDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		return this.cached(`brexitConstituency-${location}-${datasetId}`, () => {
			const codeProp = this.propertyDetector.detectConstituencyCode(
				geojson.features,
			);
			const features = geojson.features;

			let totalLeave = 0;
			let totalRemain = 0;
			let count = 0;

			for (let i = 0; i < features.length; i++) {
				const area =
					constituencyData[
						getFeatureProp(features[i].properties, codeProp) ?? ""
					];
				if (!area) continue;

				totalLeave += area.pctLeave;
				totalRemain += 100 - area.pctLeave;
				count++;
			}

			const result: AggregatedBrexitData = {
				totalLeave,
				totalRemain,
				totalVotes: count,
				pctLeave: count > 0 ? totalLeave / count : 0,
				pctRemain: count > 0 ? totalRemain / count : 0,
				electorate: 0,
			};
			return result;
		});
	}

	calculateCustomDatasetStats(
		geojson: BoundaryGeojson,
		data: Record<string, number>,
		location: string | null,
		datasetId: string | null,
	) {
		return this.cached(`custom-dataset-${location}-${datasetId}`, () => {
			const codeProp = this.propertyDetector.detectCode(geojson.features);

			let sum = 0;
			let count = 0;
			for (let i = 0; i < geojson.features.length; i++) {
				const featureCode =
					getFeatureProp(geojson.features[i].properties, codeProp) ?? "";
				const featureData = data[featureCode];

				if (typeof featureData === "number") {
					sum += featureData;
					count++;
				}
			}

			const average = count > 0 ? sum / count : 0;

			const result: AggregatedCustomData = {
				count,
				average,
			};
			return result;
		});
	}

	calculateLifeExpectancyStats(
		geojson: BoundaryGeojson,
		leData: LifeExpectancyDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedLifeExpectancyData {
		return this.cached(`lifeExpectancy-${location}-${datasetId}`, () => {
			const ladCodeProp = this.propertyDetector.detectLocalAuthorityCode(
				geojson.features,
			);
			let totalMale = 0;
			let totalFemale = 0;
			let count = 0;

			for (const feature of geojson.features) {
				const code = getFeatureProp(feature.properties, ladCodeProp) ?? "";
				const record = leData[code];
				if (record) {
					totalMale += record.maleBirthLE;
					totalFemale += record.femaleBirthLE;
					count++;
				}
			}

			const stats: AggregatedLifeExpectancyData = {
				averageMaleLE: count > 0 ? totalMale / count : 0,
				averageFemaleLE: count > 0 ? totalFemale / count : 0,
			};
			return stats;
		});
	}

	calculateSIMDStats(
		geojson: BoundaryGeojson,
		simdData: SIMDDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedSIMDData | null {
		return this.cached(`simd-${location}-${datasetId}`, () => {
			const dzCodeProp = this.propertyDetector.detectDataZoneCode(
				geojson.features,
			);
			let totalRank = 0;
			let totalQuintile = 0;
			let totalDecile = 0;
			let count = 0;

			for (const feature of geojson.features) {
				const code = getFeatureProp(feature.properties, dzCodeProp) ?? "";
				const record = simdData[code];
				if (record) {
					totalRank += record.simdRank;
					totalQuintile += record.simdQuintile;
					totalDecile += record.simdDecile;
					count++;
				}
			}

			if (count === 0) return null;

			const stats: AggregatedSIMDData = {
				averageSIMDRank: totalRank / count,
				averageSIMDQuintile: totalQuintile / count,
				averageSIMDDecile: totalDecile / count,
			};
			return stats;
		});
	}

	calculateWIMDStats(
		geojson: BoundaryGeojson,
		wimdData: WIMDDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedWIMDData | null {
		return this.cached(`wimd-${location}-${datasetId}`, () => {
			const lsoaCodeProp = this.propertyDetector.detectLSOACode(
				geojson.features,
			);
			let totalScore = 0;
			let totalRank = 0;
			let totalDecile = 0;
			let count = 0;

			for (const feature of geojson.features) {
				const code = getFeatureProp(feature.properties, lsoaCodeProp) ?? "";
				const record = wimdData[code];
				if (record) {
					totalScore += record.wimdScore;
					totalRank += record.wimdRank;
					totalDecile += record.wimdDecile;
					count++;
				}
			}

			if (count === 0) return null;

			const stats: AggregatedWIMDData = {
				averageWIMDScore: totalScore / count,
				averageWIMDRank: totalRank / count,
				averageWIMDDecile: totalDecile / count,
			};
			return stats;
		});
	}

	calculateNIMDMStats(
		geojson: BoundaryGeojson,
		nimdmData: NIMDMDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedNIMDMData | null {
		return this.cached(`nimdm-${location}-${datasetId}`, () => {
			const soaCodeProp = this.propertyDetector.detectSOACode(
				geojson.features,
			);
			let totalRank = 0;
			let totalDecile = 0;
			let count = 0;

			for (const feature of geojson.features) {
				const code = getFeatureProp(feature.properties, soaCodeProp) ?? "";
				const record = nimdmData[code];
				if (record) {
					totalRank += record.nimdmRank;
					totalDecile += record.nimdmDecile;
					count++;
				}
			}

			if (count === 0) return null;

			const stats: AggregatedNIMDMData = {
				averageNIMDMRank: totalRank / count,
				averageNIMDMDecile: totalDecile / count,
			};
			return stats;
		});
	}

	calculateIMDStats(
		geojson: BoundaryGeojson,
		imdData: IMDDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedIMDData {
		return this.cached(`imd-${location}-${datasetId}`, () => {
			const lsoaCodeProp = this.propertyDetector.detectLSOACode(
				geojson.features,
			);
			let totalScore = 0;
			let totalDecile = 0;
			let count = 0;

			for (const feature of geojson.features) {
				const code = getFeatureProp(feature.properties, lsoaCodeProp) ?? "";
				const record = imdData[code];
				if (record) {
					totalScore += record.imdScore;
					totalDecile += record.imdDecile;
					count++;
				}
			}

			const stats: AggregatedIMDData = {
				averageIMDScore: count > 0 ? totalScore / count : 0,
				averageIMDDecile: count > 0 ? totalDecile / count : 0,
			};
			return stats;
		});
	}

	private aggregatePopulationData(
		geojson: BoundaryGeojson,
		populationData: PopulationDataset["data"],
		wardCodeProp: string,
	) {
		const features = geojson.features;

		// Pre-allocate objects
		const ageData: Record<string, number> = {};
		const males: Record<string, number> = {};
		const females: Record<string, number> = {};

		const aggregated = {
			totalPop: 0,
			malesPop: 0,
			femalesPop: 0,
			totalArea: 0,
			ageGroups: {
				total: {
					"0-17": 0,
					"18-29": 0,
					"30-44": 0,
					"45-64": 0,
					"65+": 0,
				} as AgeGroups,
				males: {
					"0-17": 0,
					"18-29": 0,
					"30-44": 0,
					"45-64": 0,
					"65+": 0,
				} as AgeGroups,
				females: {
					"0-17": 0,
					"18-29": 0,
					"30-44": 0,
					"45-64": 0,
					"65+": 0,
				} as AgeGroups,
			},
			ageData,
			males,
			females,
		};

		for (let i = 0; i < features.length; i++) {
			const ward =
				populationData[
					getFeatureProp(features[i].properties, wardCodeProp) ?? ""
				];
			if (!ward) continue;

			aggregated.totalPop += calculateTotal(ward.total);
			aggregated.malesPop += calculateTotal(ward.males);
			aggregated.femalesPop += calculateTotal(ward.females);

			const wardAgeGroups = {
				total: calculateAgeGroups(ward.total),
				males: calculateAgeGroups(ward.males),
				females: calculateAgeGroups(ward.females),
			};

			// Direct key access faster than loop
			aggregated.ageGroups.total["0-17"] += wardAgeGroups.total["0-17"];
			aggregated.ageGroups.total["18-29"] += wardAgeGroups.total["18-29"];
			aggregated.ageGroups.total["30-44"] += wardAgeGroups.total["30-44"];
			aggregated.ageGroups.total["45-64"] += wardAgeGroups.total["45-64"];
			aggregated.ageGroups.total["65+"] += wardAgeGroups.total["65+"];

			aggregated.ageGroups.males["0-17"] += wardAgeGroups.males["0-17"];
			aggregated.ageGroups.males["18-29"] += wardAgeGroups.males["18-29"];
			aggregated.ageGroups.males["30-44"] += wardAgeGroups.males["30-44"];
			aggregated.ageGroups.males["45-64"] += wardAgeGroups.males["45-64"];
			aggregated.ageGroups.males["65+"] += wardAgeGroups.males["65+"];

			aggregated.ageGroups.females["0-17"] +=
				wardAgeGroups.females["0-17"];
			aggregated.ageGroups.females["18-29"] +=
				wardAgeGroups.females["18-29"];
			aggregated.ageGroups.females["30-44"] +=
				wardAgeGroups.females["30-44"];
			aggregated.ageGroups.females["45-64"] +=
				wardAgeGroups.females["45-64"];
			aggregated.ageGroups.females["65+"] += wardAgeGroups.females["65+"];

			// Aggregate age data
			const totalEntries = Object.entries(ward.total);
			for (let j = 0; j < totalEntries.length; j++) {
				const [age, count] = totalEntries[j];
				ageData[age] = (ageData[age] || 0) + count;
			}

			const malesEntries = Object.entries(ward.males);
			for (let j = 0; j < malesEntries.length; j++) {
				const [age, count] = malesEntries[j];
				males[age] = (males[age] || 0) + count;
			}

			const femalesEntries = Object.entries(ward.females);
			for (let j = 0; j < femalesEntries.length; j++) {
				const [age, count] = femalesEntries[j];
				females[age] = (females[age] || 0) + count;
			}

			aggregated.totalArea += polygonAreaSqKm(
				features[i].geometry.coordinates,
			);
		}

		return aggregated;
	}

	private buildPopulationStatsResult(
		aggregated: ReturnType<DatasetAggregator["aggregatePopulationData"]>,
	) {
		const populationStats: PopulationStats = {
			total: aggregated.totalPop,
			males: aggregated.malesPop,
			females: aggregated.femalesPop,
			ageGroups: aggregated.ageGroups,
			isWardSpecific: false,
		};

		// Pre-allocate arrays
		const ages = new Array(100);
		for (let i = 0; i < 100; i++) {
			ages[i] = {
				age: i,
				count: aggregated.ageData[i.toString()] || 0,
			};
		}

		// Distribute 90+ age data using pre-computed weights
		const age90Plus = ages[90].count;
		for (let i = 90; i < 100; i++) {
			ages[i] = {
				age: i,
				count: age90Plus * AGE_90_WEIGHTS[i - 90],
			};
		}

		// Pre-allocate gender age data
		const genderAgeData = new Array(91);
		for (let age = 0; age < 91; age++) {
			genderAgeData[age] = {
				age,
				males: aggregated.males[age.toString()] || 0,
				females: aggregated.females[age.toString()] || 0,
			};
		}

		// Calculate median age
		let medianAge = 0;
		if (aggregated.totalPop > 0) {
			const halfPop = aggregated.totalPop / 2;
			let cumulative = 0;
			for (let i = 0; i < 100; i++) {
				cumulative += ages[i].count;
				if (cumulative >= halfPop) {
					medianAge = ages[i].age;
					break;
				}
			}
		}

		const density =
			aggregated.totalArea > 0
				? aggregated.totalPop / aggregated.totalArea
				: 0;

		return {
			populationStats,
			ageData: aggregated.ageData,
			ages,
			genderAgeData,
			medianAge,
			totalArea: aggregated.totalArea,
			density,
		};
	}

	calculateQualificationStats(
		geojson: BoundaryGeojson,
		qualData: QualificationDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedQualificationData {
		return this.cached(`qualification-${location}-${datasetId}`, () => {
			const ladCodeProp = this.propertyDetector.detectLocalAuthorityCode(
				geojson.features,
			);
			const seen = new Set<string>();
			const total: QualificationBreakdown = {
				noQualifications: 0,
				level1: 0,
				level2: 0,
				apprenticeship: 0,
				level3: 0,
				level4Plus: 0,
				other: 0,
				total: 0,
			};

			for (const feature of geojson.features) {
				const code = getFeatureProp(feature.properties, ladCodeProp) ?? "";
				if (seen.has(code)) continue;
				seen.add(code);
				const record = qualData[code];
				if (!record) continue;
				const b = record.breakdown;
				total.noQualifications += b.noQualifications;
				total.level1 += b.level1;
				total.level2 += b.level2;
				total.apprenticeship += b.apprenticeship;
				total.level3 += b.level3;
				total.level4Plus += b.level4Plus;
				total.other += b.other;
				total.total += b.total;
			}

			const result: AggregatedQualificationData = { breakdown: total };
			return result;
		});
	}

	calculateBroadbandStats(
		geojson: BoundaryGeojson,
		broadbandData: BroadbandDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedBroadbandData | null {
		return this.calculateNumericStats(
			"broadband", geojson, broadbandData, location, datasetId, "localAuthority", aggregateBroadband,
		);
	}

	calculateAirQualityStats(
		geojson: BoundaryGeojson,
		airQualityData: AirQualityDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedAirQualityData | null {
		return this.calculateNumericStats(
			"airQuality", geojson, airQualityData, location, datasetId, "localAuthority", aggregateAirQuality,
		);
	}

	calculateClaimantCountStats(
		geojson: BoundaryGeojson,
		data: ClaimantCountDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedClaimantCountData | null {
		return this.calculateNumericStats(
			"claimantCount", geojson, data, location, datasetId, "localAuthority", aggregateClaimantCount,
		);
	}

	calculateChildPovertyStats(
		geojson: BoundaryGeojson,
		data: ChildPovertyDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedChildPovertyData | null {
		return this.calculateNumericStats(
			"childPoverty",
			geojson,
			data,
			location,
			datasetId,
			"localAuthority",
			aggregateChildPoverty,
		);
	}

	calculateHomelessnessStats(
		geojson: BoundaryGeojson,
		data: HomelessnessDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedHomelessnessData | null {
		return this.calculateNumericStats(
			"homelessness",
			geojson,
			data,
			location,
			datasetId,
			"localAuthority",
			aggregateHomelessness,
		);
	}

	calculateFuelPovertyStats(
		geojson: BoundaryGeojson,
		data: FuelPovertyDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedFuelPovertyData | null {
		return this.calculateNumericStats(
			"fuelPoverty",
			geojson,
			data,
			location,
			datasetId,
			"lsoa",
			aggregateFuelPoverty,
		);
	}

	calculateSchoolPerformanceStats(
		geojson: BoundaryGeojson,
		data: SchoolPerformanceDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedSchoolPerformanceData | null {
		return this.calculateNumericStats(
			"schoolPerformance", geojson, data, location, datasetId, "localAuthority", aggregateSchoolPerformance,
		);
	}

	calculateNHSWaitingStats(
		geojson: BoundaryGeojson,
		dataset: NHSWaitingDataset,
		location: string | null,
		datasetId: string | null,
	): AggregatedNHSWaitingData | null {
		return this.cached(`nhsWaiting-${location}-${datasetId}`, () => {
			const ladCodeProp = this.propertyDetector.detectLocalAuthorityCode(geojson.features);
			const seenIcbs = new Set<string>();
			let total = 0, over18 = 0;

			for (const feature of geojson.features) {
				const ladCode = getFeatureProp(feature.properties, ladCodeProp) ?? "";
				const icbCode = dataset.ladToIcb[ladCode];
				if (!icbCode || seenIcbs.has(icbCode)) continue;
				const record = dataset.data[icbCode];
				if (!record) continue;
				seenIcbs.add(icbCode);
				total += record.total;
				over18 += record.over18Weeks;
			}

			if (total === 0) return null;

			const result: AggregatedNHSWaitingData = {
				total,
				over18Weeks: over18,
				pctOver18Weeks: (over18 / total) * 100,
			};
			return result;
		});
	}

	calculateUnemploymentStats(
		geojson: BoundaryGeojson,
		dataset: UnemploymentDataset,
		location: string | null,
		datasetId: string | null,
	): AggregatedUnemploymentData | null {
		return this.cached(`unemployment-${location}-${datasetId}`, () => {
			const ladCodeProp = this.propertyDetector.detectLocalAuthorityCode(geojson.features);
			const sums: Record<number, number> = {};
			const counts: Record<number, number> = {};
			for (const yr of dataset.years) { sums[yr] = 0; counts[yr] = 0; }

			for (const feature of geojson.features) {
				const record = dataset.data[getFeatureProp(feature.properties, ladCodeProp) ?? ""];
				if (!record) continue;
				for (const yr of dataset.years) {
					const v = record.rates[yr];
					if (v != null) { sums[yr] += v; counts[yr]++; }
				}
			}

			const rates: Record<number, number> = {};
			let hasAny = false;
			for (const yr of dataset.years) {
				if (counts[yr] > 0) { rates[yr] = sums[yr] / counts[yr]; hasAny = true; }
			}

			if (!hasAny) return null;

			const result: AggregatedUnemploymentData = {
				years: dataset.years,
				latestYear: dataset.latestYear,
				rates,
			};
			return result;
		});
	}
}
