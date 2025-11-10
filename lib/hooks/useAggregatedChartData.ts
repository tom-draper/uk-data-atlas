// lib/hooks/useAggregatedElectionData.ts
import { useMemo } from 'react';
import type {
	AggregatedLocalElectionData,
	AggregateGeneralElectionData,
	GeneralElectionDataset,
	LocalElectionDataset,
	PopulationDataset,
	AggregatedPopulationData,
	PopulationStats,
	AgeGroups
} from '@lib/types';
import { BoundaryData } from './useBoundaryData';
import { MapManager } from '../utils/mapManager';
import { CodeMapper } from './useCodeMapper';
import { calculateTotal, calculateAgeGroups } from '@lib/utils/populationHelpers';

interface UseAggregatedElectionDataParams {
	mapManager: MapManager | null;
	boundaryData: BoundaryData;
	localElectionDatasets: Record<string, LocalElectionDataset | null>;
	generalElectionDatasets: Record<string, GeneralElectionDataset | null>;
	populationDatasets: Record<string, PopulationDataset | null>;
	location: string | null;
	codeMapper: CodeMapper;
}

const GENERAL_ELECTION_YEARS = [2024, 2019, 2017, 2015] as const;

/**
 * Aggregates local, general election, and population data for the current location.
 * Leverages MapManager's internal caching to avoid redundant calculations.
 */
export function useAggregatedElectionData({
	mapManager,
	boundaryData,
	localElectionDatasets,
	generalElectionDatasets,
	populationDatasets,
	location,
	codeMapper
}: UseAggregatedElectionDataParams) {
	/**
	 * Aggregated local election data - MapManager caches internally.
	 * Only recalculates when location or datasets change.
	 */
	const aggregatedLocalElectionData = useMemo((): AggregatedLocalElectionData | null => {
		if (!mapManager || !boundaryData?.ward) {
			return null;
		}

		const result: Partial<AggregatedLocalElectionData> = {};

		for (const [year, geojson] of Object.entries(boundaryData.ward)) {
			const dataset = localElectionDatasets[year];
			if (dataset?.wardData && geojson) {
				result[year] = mapManager.calculateLocalElectionStats(
					geojson,
					dataset.wardData,
					location,
					year
				);
			} else {
				result[year] = null
			}
		}

		return result as AggregatedLocalElectionData;
	}, [mapManager, boundaryData, localElectionDatasets]);

	/**
	 * Aggregated general election data - processes all available years.
	 * MapManager caches this calculation internally.
	 */
	const aggregatedGeneralElectionData = useMemo((): AggregateGeneralElectionData | null => {
		if (!mapManager || !boundaryData?.constituency) {
			return null;
		}

		const result: Partial<AggregateGeneralElectionData> = {};

		for (const [year, geojson] of Object.entries(boundaryData.constituency)) {
			const dataset = generalElectionDatasets[`general-${year}`];
			if (dataset?.constituencyData && geojson) {
				result[year] = mapManager.calculateGeneralElectionStats(
					geojson,
					dataset.constituencyData,
					`general-${year}`
				);
			} else {
				result[year] = null;
			}
		}

		return result as AggregateGeneralElectionData;
	}, [mapManager, boundaryData.constituency, generalElectionDatasets]);

	/**
	 * Aggregated population data - calculates stats and age data.
	 */
	const aggregatedPopulationData = useMemo((): AggregatedPopulationData | null => {
		if (!mapManager || !boundaryData?.constituency) {
			return null;
		}

		const result: Partial<AggregateGeneralElectionData> = {};

		// Only one 2020 population dataset that uses ward data from 2021 - but will be more in future
		for (const year of [2020]) {
			const dataset = populationDatasets[`population-${year}`];
			const geojson = boundaryData.ward[2021]; // 2020 population data uses 2021 ward boundaries

			if (!dataset?.populationData || !geojson || !codeMapper) {
				result[year] = null;
				continue;
			}

			let populationStats: PopulationStats | null = null;
			let ageData: { [age: string]: number } = {};

			// Aggregate all wards
			let totalPop = 0, malesPop = 0, femalesPop = 0;
			const aggregatedAgeGroups = {
				total: { '0-17': 0, '18-29': 0, '30-44': 0, '45-64': 0, '65+': 0 } as AgeGroups,
				males: { '0-17': 0, '18-29': 0, '30-44': 0, '45-64': 0, '65+': 0 } as AgeGroups,
				females: { '0-17': 0, '18-29': 0, '30-44': 0, '45-64': 0, '65+': 0 } as AgeGroups
			};

			for (const wardData of Object.values(dataset.populationData)) {
				totalPop += calculateTotal(wardData.total);
				malesPop += calculateTotal(wardData.males);
				femalesPop += calculateTotal(wardData.females);

				const wardAgeGroups = {
					total: calculateAgeGroups(wardData.total),
					males: calculateAgeGroups(wardData.males),
					females: calculateAgeGroups(wardData.females)
				};

				(Object.keys(aggregatedAgeGroups.total) as Array<keyof AgeGroups>).forEach(ageGroup => {
					aggregatedAgeGroups.total[ageGroup] += wardAgeGroups.total[ageGroup];
					aggregatedAgeGroups.males[ageGroup] += wardAgeGroups.males[ageGroup];
					aggregatedAgeGroups.females[ageGroup] += wardAgeGroups.females[ageGroup];
				});

				Object.entries(wardData.total).forEach(([age, count]) => {
					ageData[age] = (ageData[age] || 0) + count;
				});
			}

			populationStats = {
				total: totalPop,
				males: malesPop,
				females: femalesPop,
				ageGroups: aggregatedAgeGroups,
				isWardSpecific: false
			};

			// Process ages array with 90+ distribution
			const ages = Array.from({ length: 100 }, (_, i) => ({
				age: i,
				count: ageData[i.toString()] || 0
			}));

			// Distribute 90+ population with exponential decay
			const age90Plus = ages[90].count;
			const decayRate = 0.15;
			const weights = Array.from({ length: 10 }, (_, i) => Math.exp(-decayRate * i));
			const totalWeight = weights.reduce((sum, w) => sum + w, 0);
			for (let i = 90; i < 100; i++) {
				const weight = weights[i - 90];
				ages[i] = { age: i, count: (age90Plus * weight) / totalWeight };
			}

			// Process gender data by age (0-90)
			const ageRange = Array.from({ length: 91 }, (_, i) => i);
			const genderAgeData: Array<{ age: number; males: number; females: number }> = [];

			// Aggregate all wards
			const aggregate = {
				males: {} as Record<string, number>,
				females: {} as Record<string, number>
			};

			for (const ward of Object.values(dataset.populationData)) {
				Object.entries(ward.males).forEach(([age, count]) => {
					aggregate.males[age] = (aggregate.males[age] || 0) + count;
				});
				Object.entries(ward.females).forEach(([age, count]) => {
					aggregate.females[age] = (aggregate.females[age] || 0) + count;
				});
			}

			for (const age of ageRange) {
				genderAgeData.push({
					age,
					males: aggregate.males[age.toString()] || 0,
					females: aggregate.females[age.toString()] || 0
				});
			}

			// Calculate median age
			// const totalPop = ages.reduce((sum, { count }) => sum + count, 0);
			let medianAge = 0;
			if (totalPop > 0) {
				const halfPop = totalPop / 2;
				let cumulative = 0;
				for (const { age, count } of ages) {
					cumulative += count;
					if (cumulative >= halfPop) {
						medianAge = age;
						break;
					}
				}
			}

			result[2020] = {
				populationStats,
				ageData,
				ages,
				genderAgeData,
				medianAge,
			};
		}

		return result;
	}, [populationDatasets, location, codeMapper]);

	return {
		aggregatedLocalElectionData,
		aggregatedGeneralElectionData,
		aggregatedPopulationData,
	};
}