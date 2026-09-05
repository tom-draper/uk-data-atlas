// lib/population/utils.ts
import {
	BoundaryGeometry,
	outerRings,
	PopulationAgeSexRecord,
	PopulationDataset,
} from "@lib/types";

export const calculateTotal = (ageData: { [age: string]: number }): number => {
	let sum = 0;
	for (const key in ageData) sum += ageData[key];
	return sum;
};

const resolveWardCode = (
	wardCode: string,
	wardName: string,
	population: PopulationDataset["data"],
	wardCodeMap: { [name: string]: string },
): string => {
	if (population[wardCode]) return wardCode;
	const normalizedName = wardName?.toLowerCase().trim();
	return wardCodeMap[normalizedName] || "";
};

export const calculateMedianAge = (
	population: PopulationAgeSexRecord,
): number | null => {
	if (!population?.total) return null;

	const ageData = population.total;
	const totalPop = calculateTotal(ageData);
	if (totalPop === 0) return null;

	const halfPop = totalPop / 2;
	let cumulativeSum = 0;

	for (let age = 0; age <= 90; age++) {
		cumulativeSum += ageData[age] || 0;
		if (cumulativeSum >= halfPop) return age;
	}

	return null;
};

// Area of one ring in square kilometres (roughly accurate for small areas)
const ringAreaSqKm = (ring: number[][]): number => {
	const R = 6371;
	if (ring.length < 4) return 0;

	let area = 0;
	for (let i = 0; i < ring.length - 1; i++) {
		const [lonStart, latStart] = ring[i];
		const [lonEnd, latEnd] = ring[i + 1];

		const latStartRad = (latStart * Math.PI) / 180;
		const latEndRad = (latEnd * Math.PI) / 180;
		const deltaLonRad = ((lonEnd - lonStart) * Math.PI) / 180;

		area += deltaLonRad * (Math.sin(latStartRad) + Math.sin(latEndRad));
	}

	return (area * R * R) / 2;
};

/** Combined area of the given outer rings, in square kilometres. */
export const ringsAreaSqKm = (rings: number[][][]): number =>
	rings.reduce(
		(total, ring) => total + (ring ? Math.abs(ringAreaSqKm(ring)) : 0),
		0,
	);

/**
 * Land area of a boundary geometry, in square kilometres. Holes are ignored:
 * only each part's outer ring counts, and a part with no ring contributes
 * nothing rather than throwing.
 */
export const polygonAreaSqKm = (geometry: BoundaryGeometry): number =>
	ringsAreaSqKm(outerRings(geometry));
