import type {
	ActiveViz,
	AggregatedPopulationData,
	BoundaryData,
	PopulationDataset,
	SelectedArea,
} from "@/lib/types";
import type { PopulationCodeResolver } from "@/lib/data/boundaries/codeMapper";
import {
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { ChartCard } from "@/components/ChartCard";
import { resolvePopulationDensity } from "@/lib/helpers/populationDensity";
import { useIsDark } from "@/lib/context/ThemeContext";

interface PopulationDensityChartProps {
	dataset: PopulationDataset;
	aggregatedData: Record<number, AggregatedPopulationData> | null;
	boundaryData: BoundaryData;
	selectedArea: SelectedArea | null;
	codeMapper?: PopulationCodeResolver;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

const createSeededRandom = (seed: number) => {
	let currentSeed = seed;
	return () => {
		currentSeed = (currentSeed * 9301 + 49297) % 233280;
		return currentSeed / 233280;
	};
};

const DENSITY_CATEGORIES = [
	{
		threshold: 2000,
		label: "Low",
		hex: "#22c55e",
		color: "bg-green-500",
		count: 15,
		variations: ["bg-green-400", "bg-green-500", "bg-green-600"],
	},
	{
		threshold: 5000,
		label: "Medium",
		hex: "#eab308",
		color: "bg-yellow-500",
		count: 30,
		variations: ["bg-yellow-400", "bg-yellow-500", "bg-yellow-600"],
	},
	{
		threshold: Infinity,
		label: "High",
		hex: "#ef4444",
		color: "bg-red-500",
		count: 50,
		variations: ["bg-red-400", "bg-red-500", "bg-red-600"],
	},
] as const;

const getDensityCategory = (density: number) => {
	for (const category of DENSITY_CATEGORIES) {
		if (density < category.threshold) return category;
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
		const indices = Array.from(
			{ length: totalSquares },
			(_, index) => index,
		);
		for (let index = indices.length - 1; index > 0; index--) {
			const randomIndex = Math.floor(seededRandom() * (index + 1));
			[indices[index], indices[randomIndex]] = [
				indices[randomIndex],
				indices[index],
			];
		}
		const colors = new Array(totalSquares).fill("bg-gray-200");
		for (let index = 0; index < category.count; index++) {
			const square = indices[index];
			const colorIndex = Math.floor(
				seededRandom() * category.variations.length,
			);
			colors[square] = category.variations[colorIndex];
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
			{squareClasses.map((className, index) => (
				<div
					key={index}
					className={`rounded-xs transition-all duration-300 ${className}`}
				/>
			))}
		</div>
	);
}

export default function PopulationDensityChart({
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
	const isActive =
		activeViz.datasetId === dataset.id && activeViz.view === "density";
	const { density, areaSqKm, total } = resolvePopulationDensity({
		dataset,
		aggregatedData,
		boundaryData,
		selectedArea,
		codeMapper,
	});
	const accentColor =
		density !== null ? getDensityCategory(density).hex : null;

	return (
		<ChartCard
			heading={`Population Density [${dataset.year}]`}
			headerEnd={
				<span
					className={`text-[9px] shrink-0 ml-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}
				>
					England &amp; Wales
				</span>
			}
			accent={accentColor}
			isActive={isActive}
			title="Office for National Statistics. Census 2021: Population Density, England and Wales. ons.gov.uk"
			onClick={() =>
				setActiveViz({
					datasetId: dataset.id,
					view: "density",
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
		>
			{!total || density === null || areaSqKm === null ? (
				<div className="h-14 flex items-center justify-center">
					{chartsLoading ? (
						<ChartContentPlaceholder className="size-full" />
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
		</ChartCard>
	);
}
