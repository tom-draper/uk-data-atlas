// components/population/density/PopulationDensityChart.tsx
import { BoundaryData } from "@/lib/hooks/useBoundaryData";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import { AggregatedPopulationData, BoundaryGeojson, PopulationDataset } from "@/lib/types";
import { calculateTotal, polygonAreaSqKm } from "@/lib/utils/population";
import { useMemo } from "react";

interface PopulationDensityChartProps {
	dataset: PopulationDataset;
	aggregatedData: AggregatedPopulationData | null;
	boundaryData: BoundaryData;
	wardCode: string | null;
	codeMapper: CodeMapper;
}

const getWardPopulationDensity = (feature: any, total: number) => {
	// Compute approximate area
	const coordinates = feature.geometry.coordinates;
	const areaSqKm = polygonAreaSqKm(coordinates);

	// Compute density
	const density = areaSqKm > 0 ? total / areaSqKm : 0;
	return { density, areaSqKm };
};

const detectPropertyKey = (geojson: BoundaryGeojson) => {
	const possibleKeys = ['WD24CD', 'WD23CD', 'WD22CD', 'WD21CD'];
	const firstFeature = geojson.features[0];
	if (!firstFeature) return possibleKeys[0];

	const props = firstFeature.properties;
	return possibleKeys.find(key => key in props) ?? possibleKeys[0];
}

const PopulationDensityChart = ({
	dataset,
	aggregatedData,
	boundaryData,
	wardCode,
	codeMapper,
}: PopulationDensityChartProps) => {
	const { density, areaSqKm, total } = useMemo(() => {
		const geojson = boundaryData.ward[2021]
		if (wardCode && geojson) {
			const codesToTry = [
				wardCode,
				codeMapper.convertWardCode(wardCode, 2021)
			].filter((code): code is string => code !== null);
			const wardCodeProp = detectPropertyKey(geojson);
			for (const code of codesToTry) {
				if (dataset.populationData[code]) {
					const wardFeature = geojson.features.find((f) => f.properties?.[wardCodeProp] === code);

					if (wardFeature) {
						const total = calculateTotal(dataset.populationData[code].total);
						return {
							...getWardPopulationDensity(wardFeature, total),
							total
						}
					}
				}
			}
		} else if (aggregatedData) {
			return { density: aggregatedData[2020].density, areaSqKm: aggregatedData[2020].totalArea, total: aggregatedData[2020].populationStats.total }
		}

		return { density: null, areaSqKm: null, total: null };
	}, [boundaryData, dataset, aggregatedData, wardCode])

	if (!total) {
		return (
			<div className="text-xs h-13 text-gray-400/80 text-center grid place-items-center mb-1">
				<div>No data available</div>
			</div>
		);
	}

	// Calculate density category for visualization
	const getDensityCategory = (density: number) => {
		if (density < 2000) return { label: 'Low', color: 'bg-green-500', count: 15 };
		if (density < 5000) return { label: 'Medium', color: 'bg-yellow-500', count: 30 };
		return { label: 'High', color: 'bg-red-500', count: 50 };
	};

	const category = getDensityCategory(density);

	// Create a grid visualization
	const gridWidth = 18;
	const gridHeight = 4;
	const totalSquares = gridWidth * gridHeight;

	// Color variations for each category
	const colorVariations = {
		'bg-green-500': ['bg-green-400', 'bg-green-500', 'bg-green-600'],
		'bg-yellow-500': ['bg-yellow-400', 'bg-yellow-500', 'bg-yellow-600'],
		'bg-red-500': ['bg-red-400', 'bg-red-500', 'bg-red-600']
	};

	// Create array of all indices and shuffle them
	const indices = Array.from({ length: totalSquares }, (_, i) => i);

	// Seeded random shuffle for consistency based on density
	const seed = Math.floor(density);
	let currentSeed = seed;
	const seededRandom = () => {
		currentSeed = (currentSeed * 9301 + 49297) % 233280;
		return currentSeed / 233280;
	};

	const shuffledIndices = indices.sort(() => seededRandom() - 0.5);

	// Map of indices to their colors
	const squareColors = new Map();
	const variations = colorVariations[category.color as keyof typeof colorVariations];

	shuffledIndices.slice(0, category.count).forEach((index) => {
		const colorIndex = Math.floor(seededRandom() * variations.length);
		squareColors.set(index, variations[colorIndex]);
	});

	return (
		<div className="relative h-14 overflow-hidden">
			<div
				className="absolute inset-0 grid gap-0.5 p-0 opacity-25"
				style={{
					gridTemplateColumns: `repeat(${gridWidth}, 1fr)`,
					gridTemplateRows: `repeat(${gridHeight}, 1fr)`
				}}
			>
				{Array.from({ length: totalSquares }).map((_, i) => (
					<div
						key={i}
						className={`rounded-xs transition-all duration-300 ${squareColors.has(i)
							? squareColors.get(i)
							: 'bg-gray-200'
							}`}
					/>
				))}
			</div>

			{/* Content overlay */}
			<div className="relative py-1 h-full flex flex-col justify-between pl-4">
				{/* Left side - Main metric */}
				<div className="flex items-baseline gap-2">
					<div className="text-xl font-bold">
						{Math.round(density).toLocaleString()}
					</div>
					<div className="text-sm">
						people/km²
					</div>
				</div>

				{/* Right side - Supporting metrics */}
				<div className="flex gap-3 text-left text-xs pb-1">
					<div className="flex">
						<div className="mr-1">Population</div>
						<div className="font-semibold">
							{total.toLocaleString()}
						</div>
					</div>
					<div className="flex">
						<div className="mr-1">Area</div>
						<div className="font-semibold">
							{areaSqKm.toFixed(1)} km²
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default PopulationDensityChart;