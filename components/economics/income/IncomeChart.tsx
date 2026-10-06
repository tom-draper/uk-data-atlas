// components/IncomeChart.tsx
"use client";
import {
	ActiveViz,
	AggregatedIncomeData,
	Dataset,
	IncomeDataset,
	SelectedArea,
} from "@lib/types";
import {
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { ChartCard, ChartCardHeaderNote } from "@/components/ChartCard";
import {
	isLocalAuthorityEstimate,
	LOCAL_AUTHORITY_ESTIMATE_NOTE,
} from "@/components/LocalAuthorityEstimateIndicator";
import { useIsDark } from "@/lib/context/ThemeContext";
import { useCurrentMapOptions } from "@/lib/context/MapOptionsContext";
import { formatCount } from "@/lib/helpers/formatCount";
import {
	selectedAreaLadRecord,
	type LadResolver,
} from "@/lib/helpers/selectedAreaLad";

interface IncomeChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, IncomeDataset>;
	aggregatedData: Record<number, AggregatedIncomeData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	codeMapper?: LadResolver;
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
	const clampedIncome = Math.max(
		minIncome,
		Math.min(medianIncome, maxIncome),
	);

	const minParticles = 4;
	const maxParticles = 100;
	const percentage = (clampedIncome - minIncome) / (maxIncome - minIncome);
	const count = Math.round(
		minParticles + percentage * (maxParticles - minParticles),
	);

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
	setActiveViz,
}: IncomeChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const dataset = availableDatasets?.[year];

	// Get income data for selected area or aggregated data
	const measure = useCurrentMapOptions().income.measure;
	let income: number | null = null;

	// We calculate data first so we can use it for the particle effects
	if (dataset) {
		if (
			selectedArea === null &&
			aggregatedData &&
			aggregatedData[dataset.year]
		) {
			income =
				measure === "mean"
					? aggregatedData[dataset.year].averageMeanIncome || null
					: aggregatedData[dataset.year].averageMedianIncome || null;
		} else if (selectedArea) {
			const annual = selectedAreaLadRecord(
				dataset.data,
				selectedArea,
				codeMapper,
				year,
			)?.annual;
			income =
				measure === "mean"
					? (annual?.mean ?? null)
					: (annual?.median ?? null);
		}
	}

	const particles = computeParticles(income);

	const isActive = !!(
		dataset &&
		activeDataset?.type === "income" &&
		activeDataset.id === `income${dataset.year}`
	);
	const formattedIncome = income
		? `£${formatCount(Math.round(income))}`
		: null;

	if (!dataset) return null;

	return (
		<ChartCard
			heading={`${measure === "mean" ? "Mean" : "Median"} Income [${dataset.year}]`}
			estimateNote={
				isLocalAuthorityEstimate(selectedArea, income !== null)
					? LOCAL_AUTHORITY_ESTIMATE_NOTE
					: undefined
			}
			headerEnd={
				<ChartCardHeaderNote isDark={isDark}>
					England
				</ChartCardHeaderNote>
			}
			accent="#10b981"
			isActive={isActive}
			minHeightClassName="isolate min-h-20"
			title="Office for National Statistics. Annual Survey of Hours and Earnings (ASHE), Table 8: Distribution of Hourly Pay. ons.gov.uk"
			onClick={() =>
				setActiveViz({
					datasetId: dataset.id,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
			background={
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
			}
		>
			{formattedIncome ? (
				<div className="relative flex justify-center items-center flex-1 z-10">
					<div
						className={`text-xl font-bold bg-transparent px-2 rounded ${isDark ? "text-gray-100" : "text-gray-800"}`}
					>
						{formattedIncome}
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
		</ChartCard>
	);
}
