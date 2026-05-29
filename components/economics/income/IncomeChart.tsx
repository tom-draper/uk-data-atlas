// components/IncomeChart.tsx
"use client";
import {
	ActiveViz,
	AggregatedIncomeData,
	Dataset,
	IncomeDataset,
	SelectedArea,
} from "@lib/types";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import {
	ChartLoadingBackground,
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { useIsDark } from "@/lib/context/ThemeContext";
import {
	useCardAccent,
	cardClass,
	chartHeadingClass,
} from "@/lib/hooks/useCardAccent";

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

// Green shades for the pound signs
const particleColors = [
	"text-green-300",
	"text-green-400",
	"text-emerald-300",
	"text-emerald-400",
	"text-teal-300",
];

function seededRandom(seed: number) {
	let s = seed;
	return () => {
		s = (s * 9301 + 49297) % 233280;
		return s / 233280;
	};
}

function computeParticles(medianIncome: number | null) {
	if (!medianIncome) return [];

	const minIncome = 25000;
	const maxIncome = 45000;
	const clampedIncome = Math.max(minIncome, Math.min(medianIncome, maxIncome));

	const minParticles = 4;
	const maxParticles = 100;
	const percentage = (clampedIncome - minIncome) / (maxIncome - minIncome);
	const count = Math.round(minParticles + percentage * (maxParticles - minParticles));

	const rand = seededRandom(Math.round(medianIncome));

	return Array.from({ length: count }).map((_, i) => ({
		id: i,
		top: `${rand() * 100}%`,
		left: `${rand() * 100}%`,
		rotation: rand() * 360,
		size: rand() * 1.5 + 0.8,
		opacity: rand() * 0.3 + 0.05,
		blur:
			rand() < 0.4
				? "blur-[1px]"
				: rand() < 0.2
					? "blur-[2px]"
					: "blur-none",
		color: particleColors[Math.floor(rand() * particleColors.length)],
	}));
}

export default function IncomeChart({
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
		if (
			selectedArea === null &&
			aggregatedData &&
			aggregatedData[dataset.year]
		) {
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

	const particles = computeParticles(medianIncome);

	const isActive = !!(
		dataset &&
		activeDataset &&
		((activeDataset.type === "income" &&
			activeDataset.id === `income${dataset.year}`) ||
			(activeViz.datasetType === "custom" &&
				activeViz.vizId === "custom"))
	);
	const formattedMedian = medianIncome
		? `£${Math.round(medianIncome).toLocaleString()}`
		: null;

	const { style, onMouseEnter, onMouseLeave } = useCardAccent(
		dataset ? "#10b981" : null,
		isActive,
		isDark,
	);

	if (!dataset) return null;

	return (
		<button
			type="button"
			style={style}
			className={cardClass(!!isActive, isDark, "isolate h-20")}
			title="Office for National Statistics. Annual Survey of Hours and Earnings (ASHE), Table 8: Distribution of Hourly Pay. ons.gov.uk"
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
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
				<h3 className={chartHeadingClass(isDark)}>
					Median Income [{dataset.year}]
				</h3>
			</div>

			{formattedMedian ? (
				<div className="relative flex justify-center items-center flex-1 z-10">
					<div
						className={`text-xl font-bold bg-transparent px-2 rounded ${isDark ? "text-gray-100" : "text-gray-800"}`}
					>
						{formattedMedian}
					</div>
				</div>
			) : (
				<div className="flex-1 mt-1 relative z-10">
					{chartsLoading ? (
						<ChartContentPlaceholder className="h-full" />
					) : (
						<div
							className={`text-xs pt-0.5 text-center ${isDark ? "text-gray-400" : "text-gray-400/80"}`}
						>
							No data available
						</div>
					)}
				</div>
			)}
		</button>
	);
}
