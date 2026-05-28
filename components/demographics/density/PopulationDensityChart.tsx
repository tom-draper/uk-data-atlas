// components/population/density/PopulationDensityChart.tsx
import { detectWardCodeForYear } from "@/lib/helpers/mapManager/propertyDetector";
import {
	ActiveViz,
	AggregatedPopulationData,
	BoundaryData,
	BoundaryGeojson,
	Feature,
	PopulationDataset,
	SelectedArea,
	getFeatureProp,
} from "@/lib/types";
import { calculateTotal, polygonAreaSqKm } from "@/lib/helpers/population";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import {
	ChartLoadingBackground,
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import {
	resolveWardData,
	getLadCachedValue,
} from "@/lib/helpers/demographicData";
import { useIsDark } from "@/lib/context/ThemeContext";
import {
	useCardAccent,
	cardClass,
	chartHeadingClass,
} from "@/lib/hooks/useCardAccent";

interface PopulationDensityChartProps {
	dataset: PopulationDataset;
	aggregatedData: Record<number, AggregatedPopulationData> | null;
	boundaryData: BoundaryData;
	selectedArea: SelectedArea | null;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

// Cache computed area per feature object — avoids re-traversing polygon vertices on every hover
const featureAreaCache = new WeakMap<Feature, number>();

const getWardPopulationDensity = (feature: Feature, total: number) => {
	let areaSqKm = featureAreaCache.get(feature);
	if (areaSqKm === undefined) {
		areaSqKm = polygonAreaSqKm(feature.geometry.coordinates);
		featureAreaCache.set(feature, areaSqKm);
	}
	const density = areaSqKm > 0 ? total / areaSqKm : 0;
	return { density, areaSqKm };
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
		hex: "#22c55e", // green-500
		color: "bg-green-500",
		count: 15,
		variations: ["bg-green-400", "bg-green-500", "bg-green-600"],
	},
	{
		threshold: 5000,
		label: "Medium",
		hex: "#eab308", // yellow-500
		color: "bg-yellow-500",
		count: 30,
		variations: ["bg-yellow-400", "bg-yellow-500", "bg-yellow-600"],
	},
	{
		threshold: Infinity,
		label: "High",
		hex: "#ef4444", // red-500
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

function DensityGrid({ density }: { density: number }) {
	const gridWidth = 18;
	const gridHeight = 4;
	const totalSquares = gridWidth * gridHeight;

	const squareClasses = (() => {
		const category = getDensityCategory(density);
		const seededRandom = createSeededRandom(Math.floor(density));

		const indices = new Array(totalSquares);
		for (let i = 0; i < totalSquares; i++) {
			indices[i] = i;
		}

		for (let i = indices.length - 1; i > 0; i--) {
			const j = Math.floor(seededRandom() * (i + 1));
			[indices[i], indices[j]] = [indices[j], indices[i]];
		}

		const colors = new Array(totalSquares).fill("bg-gray-200");
		for (let i = 0; i < category.count; i++) {
			const index = indices[i];
			const colorIndex = Math.floor(
				seededRandom() * category.variations.length,
			);
			colors[index] = category.variations[colorIndex];
		}

		return colors;
	})();

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
}

const densityCache = new Map<string, Map<number, any>>();

const featureIndexCache = new WeakMap<object, Map<string, Feature>>();

const getFeatureIndex = (
	geojson: BoundaryGeojson,
	wardCodeProp: string,
): Map<string, Feature> => {
	let index = featureIndexCache.get(geojson);
	if (!index) {
		index = new Map();
		for (const feature of geojson.features) {
			const code = feature.properties
				? getFeatureProp(feature.properties, wardCodeProp)
				: undefined;
			if (code) index.set(String(code), feature);
		}
		featureIndexCache.set(geojson, index);
	}
	return index;
};

function PopulationDensityChart({
	dataset,
	aggregatedData,
	boundaryData,
	selectedArea,
	codeMapper,
	activeViz,
	setActiveViz,
}: PopulationDensityChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const vizId = `populationDensity${dataset.year}`;
	const isActive = activeViz.vizId === vizId;

	const { density, areaSqKm, total } = (() => {
		// Handle no area selected - use aggregated data
		if (selectedArea === null && aggregatedData) {
			const data = aggregatedData[dataset.year];
			if (!data) return { density: null, areaSqKm: null, total: null };
			return {
				density: data.density,
				areaSqKm: data.totalArea,
				total: data.populationStats.total,
			};
		}

		const geojson = boundaryData.ward[dataset.boundaryYear];
		if (!geojson) {
			return { density: null, areaSqKm: null, total: null };
		}

		// Handle Ward Selection
		if (selectedArea && selectedArea.type === "ward") {
			const wardCode = selectedArea.code;
			const wardCodeProp = detectWardCodeForYear(
				geojson.features,
				dataset.boundaryYear,
			);
			const populationData = resolveWardData(
				dataset,
				wardCode,
				codeMapper,
			);

			if (populationData) {
				const featureIndex = getFeatureIndex(geojson, wardCodeProp);
				const wardFeature = featureIndex.get(wardCode);

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
			return getLadCachedValue(
				densityCache,
				selectedArea.code,
				dataset.year,
				() => {
					const wardCodes = codeMapper.getWardsForLad!(
						selectedArea.code,
						dataset.boundaryYear,
					);

					if (wardCodes.length === 0)
						return { density: null, areaSqKm: null, total: null };

					const wardCodeProp = detectWardCodeForYear(
						geojson.features,
						dataset.boundaryYear,
					);
					const featureIndex = getFeatureIndex(geojson, wardCodeProp);
					let totalPopulation = 0;
					let totalArea = 0;

					for (const wardCode of wardCodes) {
						const populationData = resolveWardData(
							dataset,
							wardCode,
							codeMapper,
						);
						if (populationData) {
							const wardFeature = featureIndex.get(wardCode);
							if (wardFeature) {
								const wardTotal = calculateTotal(
									populationData.total,
								);
								let wardArea =
									featureAreaCache.get(wardFeature);
								if (wardArea === undefined) {
									wardArea = polygonAreaSqKm(
										wardFeature.geometry.coordinates,
									);
									featureAreaCache.set(wardFeature, wardArea);
								}
								totalPopulation += wardTotal;
								totalArea += wardArea;
							}
						}
					}

					return totalArea > 0
						? {
								density: totalPopulation / totalArea,
								areaSqKm: totalArea,
								total: totalPopulation,
							}
						: { density: null, areaSqKm: null, total: null };
				},
			);
		}

		// Handle Constituency Selection (no cache — stale cache risks hiding data if computed
		// before constituency-ward mappings finish loading asynchronously)
		if (
			selectedArea &&
			selectedArea.type === "constituency" &&
			codeMapper?.getWardsForConstituency
		) {
			const wardCodes = codeMapper.getWardsForConstituency(
				selectedArea.code,
				dataset.boundaryYear,
			);

			if (wardCodes.length === 0)
				return { density: null, areaSqKm: null, total: null };

			const wardCodeProp = detectWardCodeForYear(
				geojson.features,
				dataset.boundaryYear,
			);
			const featureIndex = getFeatureIndex(geojson, wardCodeProp);
			let totalPopulation = 0;
			let totalArea = 0;

			for (const wardCode of wardCodes) {
				const populationData = resolveWardData(
					dataset,
					wardCode,
					codeMapper,
				);
				if (populationData) {
					const wardFeature = featureIndex.get(wardCode);
					if (wardFeature) {
						const wardTotal = calculateTotal(populationData.total);
						let wardArea = featureAreaCache.get(wardFeature);
						if (wardArea === undefined) {
							wardArea = polygonAreaSqKm(
								wardFeature.geometry.coordinates,
							);
							featureAreaCache.set(wardFeature, wardArea);
						}
						totalPopulation += wardTotal;
						totalArea += wardArea;
					}
				}
			}

			return totalArea > 0
				? {
						density: totalPopulation / totalArea,
						areaSqKm: totalArea,
						total: totalPopulation,
					}
				: { density: null, areaSqKm: null, total: null };
		}

		// Unsupported area type
		return { density: null, areaSqKm: null, total: null };
	})();

	const accentColor =
		density !== null ? getDensityCategory(density).hex : null;
	const { style, onMouseEnter, onMouseLeave } = useCardAccent(
		accentColor,
		isActive,
		isDark,
	);

	return (
		<div
			style={style}
			className={cardClass(isActive, isDark)}
			title="Office for National Statistics. Census 2021: Population Density, England and Wales. ons.gov.uk"
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			onClick={() =>
				setActiveViz({
					vizId: vizId,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
		>
			<ChartLoadingBackground />
			<div className="flex items-center justify-between mb-1.5">
				<h3 className={chartHeadingClass(isDark)}>
					Population Density [{dataset.year}]
				</h3>
			</div>

			{!total || density === null || areaSqKm === null ? (
				<div className="h-14 flex items-center justify-center">
					{chartsLoading ? (
						<ChartContentPlaceholder className="h-full w-full" />
					) : (
						<div
							className={`text-xs text-center pb-2 ${isDark ? "text-gray-400" : "text-gray-400/80"}`}
						>
							No data available
						</div>
					)}
				</div>
			) : (
				<div className="relative h-14 overflow-hidden">
					<DensityGrid density={density} />
					<div className="relative py-1 h-full flex flex-col justify-between pl-4">
						<div className="flex items-baseline gap-2">
							<div className="text-xl font-bold">
								{Math.round(density).toLocaleString()}
							</div>
							<div className="text-sm">people/km²</div>
						</div>
						<div className="flex text-left text-xs pb-1">
							<div className="flex pr-3">
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
			)}
		</div>
	);
}

export default PopulationDensityChart;
