// components/population/density/PopulationDensityChart.tsx
import { WARD_CODE_KEYS } from "@/lib/data/boundaries/boundaries";
import {
	AggregatedPopulationData,
	BoundaryData,
	BoundaryGeojson,
	PopulationDataset,
	SelectedArea,
} from "@/lib/types";
import { calculateTotal, polygonAreaSqKm } from "@/lib/helpers/population";
import { useMemo, memo } from "react";

interface PopulationDensityChartProps {
	dataset: PopulationDataset;
	aggregatedData: AggregatedPopulationData | null;
	boundaryData: BoundaryData;
	selectedArea: SelectedArea | null;
	codeMapper?: {
		getCodeForYear: (
			type: "ward",
			code: string,
			targetYear: number,
		) => string | undefined;
		getWardsForLad: (ladCode: string, year: number) => string[];
	};
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
	const firstFeature = geojson.features[0];
	if (!firstFeature) return WARD_CODE_KEYS[0];

	const props = firstFeature.properties;
	for (let i = 0; i < WARD_CODE_KEYS.length; i++) {
		if (WARD_CODE_KEYS[i] in props) return WARD_CODE_KEYS[i];
	}
	return WARD_CODE_KEYS[0];
};

// Seeded random number generator (extracted to avoid recreating in useMemo)
const createSeededRandom = (seed: number) => {
	let currentSeed = seed;
	return () => {
		currentSeed = (currentSeed * 9301 + 49297) % 233280;
		return currentSeed / 233280;
	};
};

// Pre-calculate density categories (constant)
const DENSITY_CATEGORIES = [
	{
		threshold: 2000,
		label: "Low",
		color: "bg-green-500",
		count: 15,
		variations: ["bg-green-400", "bg-green-500", "bg-green-600"],
	},
	{
		threshold: 5000,
		label: "Medium",
		color: "bg-yellow-500",
		count: 30,
		variations: ["bg-yellow-400", "bg-yellow-500", "bg-yellow-600"],
	},
	{
		threshold: Infinity,
		label: "High",
		color: "bg-red-500",
		count: 50,
		variations: ["bg-red-400", "bg-red-500", "bg-red-600"],
	},
] as const;

const getDensityCategory = (density: number) => {
	for (let i = 0; i < DENSITY_CATEGORIES.length; i++) {
		if (density < DENSITY_CATEGORIES[i].threshold) {
			return DENSITY_CATEGORIES[i];
		}
	}
	return DENSITY_CATEGORIES[DENSITY_CATEGORIES.length - 1];
};

// Memoized grid component
const DensityGrid = memo(({ density }: { density: number }) => {
	const gridWidth = 18;
	const gridHeight = 4;
	const totalSquares = gridWidth * gridHeight;

	const squareClasses = useMemo(() => {
		const category = getDensityCategory(density);
		const seededRandom = createSeededRandom(Math.floor(density));

		// Create shuffled indices
		const indices = new Array(totalSquares);
		for (let i = 0; i < totalSquares; i++) {
			indices[i] = i;
		}

		// Shuffle using seeded random
		for (let i = indices.length - 1; i > 0; i--) {
			const j = Math.floor(seededRandom() * (i + 1));
			[indices[i], indices[j]] = [indices[j], indices[i]];
		}

		// Create color map
		const colors = new Array(totalSquares).fill("bg-gray-200");
		for (let i = 0; i < category.count; i++) {
			const index = indices[i];
			const colorIndex = Math.floor(
				seededRandom() * category.variations.length,
			);
			colors[index] = category.variations[colorIndex];
		}

		return colors;
	}, [density, totalSquares]);

	return (
		<div
			className="absolute inset-0 grid gap-0.5 p-0 opacity-25"
			style={{
				gridTemplateColumns: `repeat(${gridWidth}, 1fr)`,
				gridTemplateRows: `repeat(${gridHeight}, 1fr)`,
			}}
		>
			{squareClasses.map((className, i) => (
				<div
					key={i}
					className={`rounded-xs transition-all duration-300 ${className}`}
				/>
			))}
		</div>
	);
});

DensityGrid.displayName = "DensityGrid";

// Cache for LAD density calculations
const densityCache = new Map<string, Map<number, any>>();

function PopulationDensityChart({
	dataset,
	aggregatedData,
	boundaryData,
	selectedArea,
	codeMapper,
}: PopulationDensityChartProps) {
	const { density, areaSqKm, total } = useMemo(() => {
		// Handle no area selected - use aggregated data
		if (selectedArea === null && aggregatedData) {
			return {
				density: aggregatedData[dataset.year].density,
				areaSqKm: aggregatedData[dataset.year].totalArea,
				total: aggregatedData[dataset.year].populationStats.total,
			};
		}

		const geojson = boundaryData.ward[dataset.boundaryYear];
		if (!geojson) {
			return { density: null, areaSqKm: null, total: null };
		}

		// Handle Ward Selection
		if (selectedArea && selectedArea.type === "ward") {
			const wardCode = selectedArea.code;
			const wardCodeProp = detectPropertyKey(geojson);

			let populationData = dataset.data[wardCode];

			// Try to map ward code if not found
			if (!populationData && codeMapper?.getCodeForYear) {
				const mappedCode = codeMapper.getCodeForYear(
					"ward",
					wardCode,
					dataset.boundaryYear,
				);
				if (mappedCode) {
					populationData = dataset.data[mappedCode];
				}
			}

			if (populationData) {
				const wardFeature = geojson.features.find(
					(f) => f.properties?.[wardCodeProp] === wardCode,
				);

				if (wardFeature) {
					const total = calculateTotal(populationData.total);
					return {
						...getWardPopulationDensity(wardFeature, total),
						total,
					};
				}
			}

			return { density: null, areaSqKm: null, total: null };
		}

		// Handle Local Authority Selection
		if (
			selectedArea &&
			selectedArea.type === "localAuthority" &&
			codeMapper?.getWardsForLad
		) {
			const ladCode = selectedArea.code;
			const cacheKey = `lad-${ladCode}`;

			if (!densityCache.has(cacheKey)) {
				densityCache.set(cacheKey, new Map());
			}
			const yearCache = densityCache.get(cacheKey)!;

			if (yearCache.has(dataset.year)) {
				return yearCache.get(dataset.year);
			}

			// Get all wards in this LAD
			const wardCodes = codeMapper.getWardsForLad(ladCode, 2024);

			if (wardCodes.length === 0) {
				const emptyResult = {
					density: null,
					areaSqKm: null,
					total: null,
				};
				yearCache.set(dataset.year, emptyResult);
				return emptyResult;
			}

			const wardCodeProp = detectPropertyKey(geojson);
			let totalPopulation = 0;
			let totalArea = 0;

			for (const wardCode of wardCodes) {
				let populationData = dataset.data?.[wardCode];

				// Try to map to the dataset's year if ward code doesn't exist
				if (!populationData && codeMapper?.getCodeForYear) {
					const mappedCode = codeMapper.getCodeForYear(
						"ward",
						wardCode,
						dataset.boundaryYear,
					);
					if (mappedCode) {
						populationData = dataset.data[mappedCode];
					}
				}

				if (populationData) {
					// Find the ward feature for area calculation
					const wardFeature = geojson.features.find(
						(f) => f.properties?.[wardCodeProp] === wardCode,
					);

					if (wardFeature) {
						const wardTotal = calculateTotal(populationData.total);
						const coordinates = wardFeature.geometry.coordinates;
						const wardArea = polygonAreaSqKm(coordinates);

						totalPopulation += wardTotal;
						totalArea += wardArea;
					}
				}
			}

			const result =
				totalArea > 0
					? {
						density: totalPopulation / totalArea,
						areaSqKm: totalArea,
						total: totalPopulation,
					}
					: { density: null, areaSqKm: null, total: null };

			// Cache the result
			yearCache.set(dataset.year, result);
			return result;
		}

		// Unsupported area type
		return { density: null, areaSqKm: null, total: null };
	}, [dataset, aggregatedData, boundaryData, selectedArea, codeMapper]);

	if (!total || density === null || areaSqKm === null) {
		return (
			<div className="text-xs h-13 text-gray-400/80 text-center grid place-items-center mb-1">
				<div>No data available</div>
			</div>
		);
	}

	const roundedDensity = Math.round(density);
	const formattedArea = areaSqKm.toFixed(1);

	return (
		<div className="relative h-14 overflow-hidden">
			<DensityGrid density={density} />

			{/* Content overlay */}
			<div className="relative py-1 h-full flex flex-col justify-between pl-4">
				{/* Left side - Main metric */}
				<div className="flex items-baseline gap-2">
					<div className="text-xl font-bold">
						{roundedDensity.toLocaleString()}
					</div>
					<div className="text-sm">people/km²</div>
				</div>

				{/* Right side - Supporting metrics */}
				<div className="flex text-left text-xs pb-1">
					<div className="flex pr-3">
						<div className="mr-1">Population</div>
						<div className="font-semibold">
							{total.toLocaleString()}
						</div>
					</div>
					<div className="flex">
						<div className="mr-1">Area</div>
						<div className="font-semibold">{formattedArea} km²</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default memo(PopulationDensityChart);
