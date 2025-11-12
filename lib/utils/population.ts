// lib/population/utils.ts
import { PopulationDataset, PopulationWardData } from '@lib/types';

export const calculateTotal = (ageData: { [age: string]: number }) => {
	return Object.values(ageData).reduce((sum, count) => sum + count, 0);
};

export const resolveWardCode = (
	wardCode: string,
	wardName: string,
	population: PopulationDataset['populationData'],
	wardCodeMap: { [name: string]: string }
): string => {
	if (population[wardCode]) return wardCode;
	const normalizedName = wardName?.toLowerCase().trim();
	return wardCodeMap[normalizedName] || '';
};

export const calculateMedianAge = (wardPopulation: PopulationWardData): number | null => {
	if (!wardPopulation?.total) return null;

	const ageData = wardPopulation.total;
	let totalPop = 0;

	for (let age = 0; age <= 90; age++) {
		totalPop += ageData[age] || 0;
	}

	const halfPop = totalPop / 2;
	let cumulativeSum = 0;

	for (let age = 0; age <= 90; age++) {
		cumulativeSum += ageData[age] || 0;
		if (cumulativeSum >= halfPop) return age;
	}

	return null;
}

// Calculates polygon area in square kilometers (roughly accurate for small areas)
export const polygonAreaSqKm = (coordinates: number[][][]): number => {
	const R = 6371; // Earth's radius in km

	// Assuming coordinates[0] is the outer ring
	const ring = coordinates[0];
	let area = 0;

	for (let i = 0; i < ring.length - 1; i++) {
		const [lon1, lat1] = ring[i];
		const [lon2, lat2] = ring[i + 1];

		// Convert degrees to radians
		const x1 = (lon1 * Math.PI) / 180;
		const y1 = (lat1 * Math.PI) / 180;
		const x2 = (lon2 * Math.PI) / 180;
		const y2 = (lat2 * Math.PI) / 180;

		// Spherical excess approximation for small polygons
		area += (x2 - x1) * (2 + Math.sin(y1) + Math.sin(y2));
	}

	area = (area * R * R) / 2;
	return Math.abs(area);
}