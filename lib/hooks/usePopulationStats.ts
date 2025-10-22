// lib/population/usePopulationStats.ts
import { useMemo } from 'react';
import { PopulationWardData, AgeGroups, PopulationStats } from '@lib/types';
import { calculateTotal, calculateAgeGroups, resolveWardCode } from '@lib/utils/populationHelpers';

export function usePopulationStats(
	population: PopulationWardData,
	wardCode: string,
	wardName: string,
	wardCodeMap: { [name: string]: string }
): PopulationStats | null {
	return useMemo((): PopulationStats | null => {
		if (!population || Object.keys(population).length === 0) return null;

		// Ward-specific data
		if (wardCode) {
			const resolvedCode = resolveWardCode(wardCode, wardName, population, wardCodeMap);

			if (resolvedCode && population[resolvedCode]) {
				const wardData = population[resolvedCode];
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
	}, [population, wardCode, wardName, wardCodeMap]);
}

export function useAgeData(
	population: PopulationWardData,
	wardCode: string,
	wardName: string,
	wardCodeMap: { [name: string]: string }
): { [age: string]: number } {
	return useMemo(() => {
		const data: { [age: string]: number } = {};

		if (wardCode) {
			const resolvedCode = resolveWardCode(wardCode, wardName, population, wardCodeMap);
			if (resolvedCode && population[resolvedCode]) {
				return population[resolvedCode].total;
			}
		} else {
			for (const wardData of Object.values(population)) {
				Object.entries(wardData.total).forEach(([age, count]) => {
					data[age] = (data[age] || 0) + count;
				});
			}
		}

		return data;
	}, [population, wardCode, wardName, wardCodeMap]);
}