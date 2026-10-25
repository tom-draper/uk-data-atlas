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
import { IncomeCardBackground } from "./IncomeCardBackground";
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
	const { measure, period } = useCurrentMapOptions().income;
	let income: number | null = null;

	// We calculate data first so we can use it for the particle effects
	if (dataset) {
		if (
			selectedArea === null &&
			aggregatedData &&
			aggregatedData[dataset.year]
		) {
			income =
				period === "hourly"
					? ((measure === "mean"
							? aggregatedData[dataset.year]
									.averageHourlyMeanIncome
							: aggregatedData[dataset.year]
									.averageHourlyMedianIncome) ?? null)
					: measure === "mean"
						? aggregatedData[dataset.year].averageMeanIncome || null
						: aggregatedData[dataset.year].averageMedianIncome ||
							null;
		} else if (selectedArea) {
			const annual = selectedAreaLadRecord(
				dataset.data,
				selectedArea,
				codeMapper,
				year,
			)?.[period];
			income =
				measure === "mean"
					? (annual?.mean ?? null)
					: (annual?.median ?? null);
		}
	}

	const isActive = !!(
		dataset &&
		activeDataset?.type === "income" &&
		activeDataset.id === `income${dataset.year}`
	);
	const formattedIncome = income
		? period === "hourly"
			? `£${income.toFixed(2)}/hour`
			: `£${formatCount(Math.round(income))}`
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
			title="Office for National Statistics. Annual Survey of Hours and Earnings (ASHE), Table 8: Residence-based pay. ons.gov.uk"
			onClick={() =>
				setActiveViz({
					datasetId: dataset.id,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
			background={<IncomeCardBackground income={income} />}
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
