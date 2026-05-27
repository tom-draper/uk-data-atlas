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

const PARTY_KEYS = [
	"LAB",
	"CON",
	"LD",
	"GREEN",
	"RUK",
	"SNP",
	"PC",
	"DUP",
	"SF",
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

export class StatsCalculator {
	constructor(
		private propertyDetector: PropertyDetector,
		private cache: StatsCache,
	) {}

	calculateLocalElectionStats(
		geojson: BoundaryGeojson,
		wardData: LocalElectionDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		const cacheKey = `local-election-${location}-${datasetId}`;
		const cached = this.cache.get(cacheKey);
		if (cached) return cached;

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

		this.cache.set(cacheKey, stats);
		return stats;
	}

	calculateGeneralElectionStats(
		geojson: BoundaryGeojson,
		constituencyData: GeneralElectionDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		const cacheKey = `general-election-${location}-${datasetId}`;
		const cached = this.cache.get(cacheKey);
		if (cached) return cached;

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

		this.cache.set(cacheKey, stats);
		return stats;
	}

	calculatePopulationStats(
		geojson: BoundaryGeojson,
		populationData: PopulationDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		const cacheKey = `population-${location}-${datasetId}`;
		const cached = this.cache.get(cacheKey);
		if (cached) return cached;

		const wardCodeProp = this.propertyDetector.detectWardCode(
			geojson.features,
		);
		const aggregated = this.aggregatePopulationData(
			geojson,
			populationData,
			wardCodeProp,
		);
		const result = this.buildPopulationStatsResult(aggregated);

		this.cache.set(cacheKey, result);
		return result;
	}

	calculateEthnicityStats(
		geojson: BoundaryGeojson,
		localAuthorityData: EthnicityDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		const cacheKey = `ethnicity-${location}-${datasetId}`;
		const cached = this.cache.get(cacheKey);
		if (cached) return cached;

		const ladProp = this.propertyDetector.detectLocalAuthorityCode(
			geojson.features,
		);
		const features = geojson.features;

		// Aggregate all ethnicity data across all features
		const aggregated: Record<
			string,
			Record<string, { population: number; code: string }>
		> = {};
		let totalPopulation = 0;

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
					totalPopulation += ethnicity.population;
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

		this.cache.set(cacheKey, result);
		return result;
	}

	calculateHousePriceStats(
		geojson: BoundaryGeojson,
		wardData: Record<string, HousePriceWardData>,
		location: string | null,
		datasetId: string | null,
	) {
		const cacheKey = `house-price-${location}-${datasetId}`;
		const cached = this.cache.get(cacheKey);
		if (cached) return cached;

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

		this.cache.set(cacheKey, result);
		return result;
	}

	calculateCrimeStats(
		geojson: BoundaryGeojson,
		crimeData: CrimeDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		const cacheKey = `crime-${location}-${datasetId}`;
		const cached = this.cache.get(cacheKey);
		if (cached) return cached;

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
		this.cache.set(cacheKey, result);
		return result;
	}

	calculateIncomeStats(
		geojson: BoundaryGeojson,
		incomeData: IncomeDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		const cacheKey = `income-${location}-${datasetId}`;
		const cached = this.cache.get(cacheKey);
		if (cached) return cached;

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
			if (locationIncome?.annual?.median) {
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

		this.cache.set(cacheKey, result);
		return result;
	}

	calculateBrexitStats(
		geojson: BoundaryGeojson,
		brexitData: BrexitLADDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		const cacheKey = `brexit-${location}-${datasetId}`;
		const cached = this.cache.get(cacheKey);
		if (cached) return cached;

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

		this.cache.set(cacheKey, result);
		return result;
	}

	calculateBrexitConstituencyStats(
		geojson: BoundaryGeojson,
		constituencyData: BrexitConstituencyDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		const cacheKey = `brexitConstituency-${location}-${datasetId}`;
		const cached = this.cache.get(cacheKey);
		if (cached) return cached;

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

		this.cache.set(cacheKey, result);
		return result;
	}

	calculateCustomDatasetStats(
		geojson: BoundaryGeojson,
		data: Record<string, number>,
		location: string | null,
		datasetId: string | null,
	) {
		const cacheKey = `custom-dataset-${location}-${datasetId}`;
		const cached = this.cache.get(cacheKey);
		if (cached) return cached;

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

		this.cache.set(cacheKey, result);
		return result;
	}

	calculateLifeExpectancyStats(
		geojson: BoundaryGeojson,
		leData: LifeExpectancyDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedLifeExpectancyData {
		const cacheKey = `lifeExpectancy-${location}-${datasetId}`;
		const cached = this.cache.get(
			cacheKey,
		) as AggregatedLifeExpectancyData | null;
		if (cached) return cached;

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

		this.cache.set(cacheKey, stats);
		return stats;
	}

	calculateSIMDStats(
		geojson: BoundaryGeojson,
		simdData: SIMDDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedSIMDData {
		const cacheKey = `simd-${location}-${datasetId}`;
		const cached = this.cache.get(cacheKey) as AggregatedSIMDData | null;
		if (cached) return cached;

		const dzCodeProp = this.propertyDetector.detectDataZoneCode(
			geojson.features,
		);
		let totalRank = 0;
		let totalQuintile = 0;
		let count = 0;

		for (const feature of geojson.features) {
			const code = getFeatureProp(feature.properties, dzCodeProp) ?? "";
			const record = simdData[code];
			if (record) {
				totalRank += record.simdRank;
				totalQuintile += record.simdQuintile;
				count++;
			}
		}

		const stats: AggregatedSIMDData = {
			averageSIMDRank: count > 0 ? totalRank / count : 0,
			averageSIMDQuintile: count > 0 ? totalQuintile / count : 0,
		};

		this.cache.set(cacheKey, stats);
		return stats;
	}

	calculateWIMDStats(
		geojson: BoundaryGeojson,
		wimdData: WIMDDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedWIMDData {
		const cacheKey = `wimd-${location}-${datasetId}`;
		const cached = this.cache.get(cacheKey) as AggregatedWIMDData | null;
		if (cached) return cached;

		const lsoaCodeProp = this.propertyDetector.detectLSOACode(
			geojson.features,
		);
		let totalScore = 0;
		let totalDecile = 0;
		let count = 0;

		for (const feature of geojson.features) {
			const code = getFeatureProp(feature.properties, lsoaCodeProp) ?? "";
			const record = wimdData[code];
			if (record) {
				totalScore += record.wimdScore;
				totalDecile += record.wimdDecile;
				count++;
			}
		}

		const stats: AggregatedWIMDData = {
			averageWIMDScore: count > 0 ? totalScore / count : 0,
			averageWIMDDecile: count > 0 ? totalDecile / count : 0,
		};

		this.cache.set(cacheKey, stats);
		return stats;
	}

	calculateNIMDMStats(
		geojson: BoundaryGeojson,
		nimdmData: NIMDMDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedNIMDMData {
		const cacheKey = `nimdm-${location}-${datasetId}`;
		const cached = this.cache.get(cacheKey) as AggregatedNIMDMData | null;
		if (cached) return cached;

		const soaCodeProp = this.propertyDetector.detectSOACode(
			geojson.features,
		);
		let totalDecile = 0;
		let count = 0;

		for (const feature of geojson.features) {
			const code = getFeatureProp(feature.properties, soaCodeProp) ?? "";
			const record = nimdmData[code];
			if (record) {
				totalDecile += record.nimdmDecile;
				count++;
			}
		}

		const stats: AggregatedNIMDMData = {
			averageNIMDMDecile: count > 0 ? totalDecile / count : 0,
		};

		this.cache.set(cacheKey, stats);
		return stats;
	}

	calculateIMDStats(
		geojson: BoundaryGeojson,
		imdData: IMDDataset["data"],
		location: string | null,
		datasetId: string | null,
	): AggregatedIMDData {
		const cacheKey = `imd-${location}-${datasetId}`;
		const cached = this.cache.get(cacheKey) as AggregatedIMDData | null;
		if (cached) return cached;

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

		this.cache.set(cacheKey, stats);
		return stats;
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
		aggregated: ReturnType<StatsCalculator["aggregatePopulationData"]>,
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
		const cacheKey = `qualification-${location}-${datasetId}`;
		const cached = this.cache.get(
			cacheKey,
		) as AggregatedQualificationData | null;
		if (cached) return cached;

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
		this.cache.set(cacheKey, result);
		return result;
	}
}
