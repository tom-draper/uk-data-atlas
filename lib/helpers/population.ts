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
	const R = 6371;

	const calculateRingArea = (ring: number[][]): number => {
		if (ring.length < 4) {
			return 0;
		}

		let area = 0;
		for (let i = 0; i < ring.length - 1; i++) {
			const [lonStart, latStart] = ring[i];
			const [lonEnd, latEnd] = ring[i + 1];

			const latStartRad = (latStart * Math.PI) / 180;
			const latEndRad = (latEnd * Math.PI) / 180;
			const deltaLonRad = ((lonEnd - lonStart) * Math.PI) / 180;

			area += deltaLonRad * (Math.sin(latStartRad) + Math.sin(latEndRad));
		}

		return area * R * R / 2;
	};

	let totalArea = 0;

	// Check if coordinates[0][0][0] is a number (simple) or array (multi-chunk)
	const isSimplePolygon = typeof coordinates[0]?.[0]?.[0] === 'number';

	if (isSimplePolygon) {
		// Simple case: coordinates[0] is the ring
		totalArea = Math.abs(calculateRingArea(coordinates[0]));
	} else {
		// Multi-chunk case: each coordinates[i][0] is a ring
		for (let i = 0; i < coordinates.length; i++) {
			const ring = coordinates[i][0];
			const chunkArea = Math.abs(calculateRingArea(ring));
			totalArea += chunkArea;
		}
	}

	return totalArea;
};