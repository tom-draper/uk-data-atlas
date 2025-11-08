// components/population/density/PopulationDensityChart.tsx
import { BoundaryGeojson } from "@/lib/types";

interface PopulationDensityChartProps {
	geojson: BoundaryGeojson | null;
	total: number;
	wardCode: string | null;
}

const polygonAreaSqKm = (coordinates: number[][][]) => {
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
};

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
	total,
	geojson,
	wardCode,
}: PopulationDensityChartProps) => {
	if (total === 0) {
		return (
			<div className="text-xs h-13 text-gray-400/80 text-center grid place-items-center mb-1">
				<div>No data available</div>
			</div>
		);
	}

	let densityInfo = null;

	if (wardCode && geojson) {
		const wardCodeProp = detectPropertyKey(geojson);
		// Find the specific ward feature
		const wardFeature = geojson.features.find((f) => f.properties?.[wardCodeProp] === wardCode);

		if (wardFeature) {
			densityInfo = getWardPopulationDensity(wardFeature, total);
		}
	} else if (geojson) {
		// Calculate average density across all wards
		const allDensities = geojson.features.map((feature) => {
			// You'd need population data per ward here
			// This is a simplified version
			return getWardPopulationDensity(feature, total / geojson.features.length);
		});

		console.log(allDensities)

		const totalArea = allDensities.reduce((sum, d) => sum + d.areaSqKm, 0);
		const avgDensity = totalArea > 0 ? total / totalArea : 0;

		densityInfo = { density: avgDensity, areaSqKm: totalArea };
	}

	if (densityInfo === null) {
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

	const category = getDensityCategory(densityInfo.density);
	
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
	const seed = Math.floor(densityInfo.density);
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
			{/* Background grid - full width */}
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
						className={`rounded-xs transition-all duration-300 ${
							squareColors.has(i)
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
					<div className="text-xl font-bold text-black">
						{Math.round(densityInfo.density).toLocaleString()}
					</div>
					<div className="text-sm">
						people/km²
					</div>
				</div>

				{/* Right side - Supporting metrics */}
				<div className="flex gap-4 text-left text-xs pb-1">
					<div className="flex">
						<div className="mr-1">Population</div>
						<div className="font-semibold">
							{total.toLocaleString()}
						</div>
					</div>
					<div className="flex">
						<div className="mr-1">Area</div>
						<div className="font-semibold">
							{densityInfo.areaSqKm.toFixed(1)} km²
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default PopulationDensityChart;