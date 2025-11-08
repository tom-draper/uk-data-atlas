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

// Mock data for demonstration
const PopulationDensityChart = ({
	total,
	geojson,
	wardCode,
}: PopulationDensityChartProps) => {
	if (total === 0) {
		return (
			<div className="text-xs h-9 text-gray-400/80 text-center grid place-items-center">
				<div className="mb-4">No data available</div>
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

		const totalArea = allDensities.reduce((sum, d) => sum + d.areaSqKm, 0);
		const avgDensity = totalArea > 0 ? total / totalArea : 0;

		densityInfo = { density: avgDensity, areaSqKm: totalArea };
	}

	if (densityInfo === null) {
		return (
			<div className="text-xs h-9 text-gray-400/80 text-center grid place-items-center">
				<div className="mb-4">No data available</div>
			</div>
		);
	}

	// Calculate density category for visualization
	// Assuming typical urban densities: Low <2000, Medium 2000-5000, High >5000
	const getDensityCategory = (density) => {
		if (density < 2000) return { label: 'Low', color: 'bg-green-500', fill: 0.3 };
		if (density < 5000) return { label: 'Medium', color: 'bg-yellow-500', fill: 0.6 };
		return { label: 'High', color: 'bg-red-500', fill: 0.9 };
	};

	const category = getDensityCategory(densityInfo.density);
	
	// Create a grid visualization (10x10 grid = 100 squares)
	const gridSize = 10;
	const totalSquares = gridSize * gridSize;
	const filledSquares = Math.round(totalSquares * category.fill);

	return (
		<div className="space-y-4 p-4">
			{/* Main Density Display */}
			<div className="text-center space-y-1">
				<div className="text-2xl font-bold text-gray-800">
					{densityInfo.density.toFixed(0)}
				</div>
				<div className="text-xs text-gray-500 uppercase tracking-wide">
					people per km²
				</div>
				<div className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
					{category.label} Density
				</div>
			</div>

			{/* Visual Density Grid */}
			<div className="flex justify-center">
				<div 
					className="grid gap-1 p-3 bg-gray-50 rounded-lg"
					style={{ 
						gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
						width: 'fit-content'
					}}
				>
					{Array.from({ length: totalSquares }).map((_, i) => (
						<div
							key={i}
							className={`w-3 h-3 rounded-sm transition-all duration-300 ${
								i < filledSquares 
									? category.color 
									: 'bg-gray-200'
							}`}
						/>
					))}
				</div>
			</div>

			{/* Stats Row */}
			<div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200">
				<div className="text-center">
					<div className="text-xs text-gray-500 mb-1">Population</div>
					<div className="text-sm font-semibold text-gray-800">
						{total.toLocaleString()}
					</div>
				</div>
				<div className="text-center">
					<div className="text-xs text-gray-500 mb-1">Area</div>
					<div className="text-sm font-semibold text-gray-800">
						{densityInfo.areaSqKm.toFixed(2)} km²
					</div>
				</div>
			</div>

			{/* Visual comparison bars */}
			<div className="space-y-2 pt-2">
				<div className="space-y-1">
					<div className="flex justify-between text-[10px] text-gray-500">
						<span>Population</span>
						<span>{total.toLocaleString()}</span>
					</div>
					<div className="h-2 bg-gray-100 rounded-full overflow-hidden">
						<div 
							className="h-full bg-linear-to-r from-blue-400 to-blue-600 transition-all duration-500"
							style={{ width: '100%' }}
						/>
					</div>
				</div>
				<div className="space-y-1">
					<div className="flex justify-between text-[10px] text-gray-500">
						<span>Area</span>
						<span>{densityInfo.areaSqKm.toFixed(2)} km²</span>
					</div>
					<div className="h-2 bg-gray-100 rounded-full overflow-hidden">
						<div 
							className="h-full bg-linear-to-r from-green-400 to-green-600 transition-all duration-500"
							style={{ 
								width: `${Math.min((densityInfo.areaSqKm / 10) * 100, 100)}%` 
							}}
						/>
					</div>
				</div>
			</div>
		</div>
	);
};

export default PopulationDensityChart;