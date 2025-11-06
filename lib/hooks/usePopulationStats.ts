// lib/population/usePopulationStats.ts
import { useMemo } from 'react';
import { AgeGroups, PopulationStats, PopulationDataset } from '@lib/types';
import { WardCodeMapper } from '@lib/hooks/useWardCodeMapper';
import { calculateTotal, calculateAgeGroups } from '@lib/utils/populationHelpers';

export function usePopulationStats(
	population: PopulationDataset['populationData'],
	wardCode: string,
	wardName: string,
	wardCodeMapper: WardCodeMapper
): PopulationStats | null {
	return useMemo((): PopulationStats | null => {
		if (!population || Object.keys(population).length === 0) return null;

		// Ward-specific data
		if (wardCode) {
			// Try to find the ward data - population uses 2021 codes
			const codesToTry = [
				wardCode,
				wardCodeMapper.convertWardCode(wardCode, 2021)
			].filter((code): code is string => code !== null);

			for (const code of codesToTry) {
				if (population[code]) {
					const wardData = population[code];
					return {
						total: calculateTotal(wardData.total),
						males: calculateTotal(wardData.males),
						females: calculateTotal(wardData.females),
						ageGroups: {
							total: calculateAgeGroups(wardData.total),
							males: calculateAgeGroups(wardData.males),
							females: calculateAgeGroups(wardData.females),
						},
						isWardSpecific: true
					};
				}
			}

			// No data found for this ward
			return null;
		}

		// Aggregate all wards
		let totalPop = 0, malesPop = 0, femalesPop = 0;
		const aggregatedAgeGroups = {
			total: { '0-17': 0, '18-29': 0, '30-44': 0, '45-64': 0, '65+': 0 } as AgeGroups,
			males: { '0-17': 0, '18-29': 0, '30-44': 0, '45-64': 0, '65+': 0 } as AgeGroups,
			females: { '0-17': 0, '18-29': 0, '30-44': 0, '45-64': 0, '65+': 0 } as AgeGroups
		};

		for (const wardData of Object.values(population)) {
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
		}

		return {
			total: totalPop,
			males: malesPop,
			females: femalesPop,
			ageGroups: aggregatedAgeGroups,
			isWardSpecific: false
		};
	}, [population, wardCode, wardName, wardCodeMapper]);
}

export function useAgeData(
	population: PopulationDataset['populationData'],
	wardCode: string,
	wardName: string,
	wardCodeMapper: WardCodeMapper
): { [age: string]: number } {
	return useMemo(() => {
		const data: { [age: string]: number } = {};

		if (wardCode) {
			// Try to find the ward data - population uses 2021 codes
			const codesToTry = [
				wardCode,
				wardCodeMapper.convertWardCode(wardCode, 2021)
			].filter((code): code is string => code !== null);

			for (const code of codesToTry) {
				if (population[code]) {
					return population[code].total;
				}
			}

			// No data found, return empty
			return data;
		} else {
			// Aggregate all wards
			for (const wardData of Object.values(population)) {
				Object.entries(wardData.total).forEach(([age, count]) => {
					data[age] = (data[age] || 0) + count;
				});
			}
		}

		return data;
	}, [population, wardCode, wardName, wardCodeMapper]);
}