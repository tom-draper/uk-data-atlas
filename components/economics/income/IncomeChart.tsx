// components/IncomeChart.tsx
"use client";
import {
	ActiveViz,
	AggregatedIncomeData,
	Dataset,
	IncomeDataset,
	SelectedArea,
} from "@lib/types";
import { memo, useMemo } from "react";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import {
	ChartLoadingBackground,
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { useIsDark } from "@/lib/context/ThemeContext";

interface IncomeChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, IncomeDataset>;
	aggregatedData: Record<number, AggregatedIncomeData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

const colors = {
	bg: "bg-emerald-50/60",
	border: "border-emerald-300",
	inactive:
		"bg-white/60 border-2 border-gray-200/80 hover:border-emerald-300",
};

// Green shades for the pound signs
const particleColors = [
	"text-green-300",
	"text-green-400",
	"text-emerald-300",
	"text-emerald-400",
	"text-teal-300",
];

export default memo(function IncomeChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	codeMapper,
	activeViz,
	setActiveViz,
}: IncomeChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const dataset = availableDatasets?.[year];

	// Get income data for selected area or aggregated data
	let medianIncome: number | null = null;

	// We calculate data first so we can use it for the particle effects
	if (dataset) {
		if (selectedArea === null && aggregatedData && aggregatedData[dataset.year]) {
			medianIncome = aggregatedData[dataset.year].averageIncome || null;
		} else if (
			selectedArea &&
			selectedArea.type === "localAuthority" &&
			selectedArea.data
		) {
			const laCode = selectedArea.code;
			medianIncome = dataset.data?.[laCode]?.annual?.median || null;

			// Try code mapping if not found
			if (!medianIncome && codeMapper) {
				const mappedCode = codeMapper.getCodeForYear(
					"localAuthority",
					laCode,
					year,
				);
				if (mappedCode) {
					medianIncome =
						dataset.data?.[mappedCode]?.annual?.median || null;
				}
			}
		}
	}

	const particles = useMemo(() => {
		if (!medianIncome) return [];

		// Clamp income between 25k and 45k for the visual calculation
		const minIncome = 25000;
		const maxIncome = 45000;
		const clampedIncome = Math.max(
			minIncome,
			Math.min(medianIncome, maxIncome),
		);

		const minParticles = 4;
		const maxParticles = 100;
		const percentage =
			(clampedIncome - minIncome) / (maxIncome - minIncome);
		const count = Math.round(
			minParticles + percentage * (maxParticles - minParticles),
		);

		// Generate static random properties for the particles
		return Array.from({ length: count }).map((_, i) => ({
			id: i,
			top: `${Math.random() * 100}%`,
			left: `${Math.random() * 100}%`,
			rotation: Math.random() * 360,
			size: Math.random() * 1.5 + 0.8, // rem
			opacity: Math.random() * 0.3 + 0.05, // Very faint (0.05 to 0.35)
			blur:
				Math.random() < 0.4
					? "blur-[1px]"
					: Math.random() < 0.2
						? "blur-[2px]"
						: "blur-none", // Depth of field
			color: particleColors[
				Math.floor(Math.random() * particleColors.length)
			],
		}));
	}, [medianIncome]);

	if (!dataset) return null;
	const isActive =
		activeDataset &&
		((activeDataset.type === "income" &&
			activeDataset.id === `income${dataset.year}`) ||
			(activeViz.datasetType === "custom" && activeViz.vizId === "custom"));
	const formattedMedian = medianIncome
		? `£${Math.round(medianIncome).toLocaleString()}`
		: null;

	return (
		<div
			className={`p-2 rounded transition-all duration-300 ease-in-out cursor-pointer overflow-hidden relative isolate h-20 ${isActive
					? `${isDark ? "bg-white/10" : colors.bg} border-2 ${colors.border}`
					: isDark ? "bg-white/5 border-2 border-white/10 hover:border-emerald-300" : colors.inactive
				}`}
			title="Office for National Statistics. Annual Survey of Hours and Earnings (ASHE), Table 8: Distribution of Hourly Pay. ons.gov.uk"
			onClick={() =>
				setActiveViz({
					vizId: dataset.id,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
		>
			<ChartLoadingBackground />
			{/* Background Particles Layer */}
			<div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
				{particles.map((p) => (
					<span
						key={p.id}
						className={`absolute font-bold ${p.color} ${p.blur}`}
						style={{
							top: p.top,
							left: p.left,
							fontSize: `${p.size}rem`,
							opacity: p.opacity,
							transform: `rotate(${p.rotation}deg)`,
						}}
					>
						£
					</span>
				))}
			</div>

			<div className="flex items-center justify-between mb-1.5 relative z-10">
				<h3 className={`text-xs font-bold ${isDark ? "text-gray-200" : "text-gray-700"}`}>
					Median Income [{dataset.year}]
				</h3>
			</div>

			{formattedMedian ? (
				<div className="relative flex justify-center items-center mt-3 mb-1 z-10 h-5">
					<div className={`text-xl font-bold bg-transparent px-2 rounded ${isDark ? "text-gray-100" : "text-gray-800"}`}>
						{formattedMedian}
					</div>
				</div>
			) : (
				<div className="h-7 mt-2 mb-2 relative z-10">
					{chartsLoading ? (
						<ChartContentPlaceholder className="h-full" />
					) : (
						<div className={`text-xs pt-0.5 text-center ${isDark ? "text-gray-400" : "text-gray-400/80"}`}>
							No data available
						</div>
					)}
				</div>
			)}
			</div>
	);
});
