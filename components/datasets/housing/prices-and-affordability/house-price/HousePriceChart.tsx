"use client";

import { formatDatasetCoverage } from "@/lib/helpers/datasetCoverage";
import type {
	ActiveViz,
	AggregatedHousePriceData,
	Dataset,
	HousePriceDataset,
	SelectedArea,
} from "@lib/types";
import type { PopulationCodeResolver } from "@/lib/data/boundaries/codeMapper";
import {
	HousePriceSeriesCache,
	type HousePriceSeriesInput,
} from "@/lib/helpers/housePriceSeries";
import {
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { ChartCard } from "@/components/ChartCard";
import { useCurrentMapOptions } from "@/lib/context/MapOptionsContext";
import { SparklineBackground } from "@/components/measures/SparklineBackground";
import { sparkline } from "@/lib/measures/series";
import { useIsDark } from "@/lib/context/ThemeContext";
import { formatCount } from "@/lib/helpers/formatCount";

interface HousePriceChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, HousePriceDataset>;
	aggregatedData: Record<number, AggregatedHousePriceData> | null;
	year: number;
	selectedArea: SelectedArea | null;
	codeMapper?: PopulationCodeResolver;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

interface PriceChartProps {
	dataset: HousePriceDataset;
	aggregatedData: Record<number, AggregatedHousePriceData> | null;
	selectedArea: SelectedArea | null;
	codeMapper?: HousePriceSeriesInput["codeMapper"];
	mappingGeneration: number;
	measure: HousePriceSeriesInput["measure"];
	isActive: boolean;
	setActiveViz: (value: ActiveViz) => void;
}

const LINE_COLOR = "#6366f1";
const housePriceSeriesCache = new HousePriceSeriesCache();

function PriceChart({
	dataset,
	aggregatedData,
	selectedArea,
	codeMapper,
	mappingGeneration,
	measure,
	isActive,
	setActiveViz,
}: PriceChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const { priceData, currentPrice } = housePriceSeriesCache.resolve(
		{
			dataset,
			aggregatedData,
			selectedArea,
			measure,
			codeMapper,
		},
		mappingGeneration,
	);

	const line = sparkline(
		priceData.map((datum) => datum.price),
		{ domain: [0, 700000] },
	);

	const formattedPrice = currentPrice
		? `£${formatCount(Math.round(currentPrice))}`
		: null;

	return (
		<ChartCard
			coverage={formatDatasetCoverage(dataset)}
			heading={`${measure === "mean" ? "Mean" : "Median"} House Price [${dataset.year}]`}
			accent={LINE_COLOR}
			isActive={isActive}
			title="Office for National Statistics. Final ward-level median and mean house-price data for England and Wales, year ending March 2023. ons.gov.uk"
			onClick={() =>
				setActiveViz({
					datasetId: dataset.id,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
			background={
				line && (
					<SparklineBackground
						sparkline={line}
						color={LINE_COLOR}
						gradientId={`gradient-${dataset.year}`}
						fade={[
							{ offset: "0%", opacity: 0.1 },
							{ offset: "100%", opacity: 0.05 },
						]}
						strokeWidth={2.5}
					/>
				)
			}
		>
			{formattedPrice ? (
				<div className="relative flex justify-end items-end flex-1 z-10">
					<div
						className={`text-xl font-bold ${!currentPrice ? "text-gray-400 text-sm" : ""}`}
					>
						{formattedPrice}
					</div>
				</div>
			) : (
				<div className="flex-1 mt-1">
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

export default function HousePriceChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	year,
	selectedArea,
	codeMapper,
	setActiveViz,
}: HousePriceChartProps) {
	const measure = useCurrentMapOptions()["house-price"].measure;
	const dataset = availableDatasets?.[year];
	if (!dataset) return null;

	const isActive =
		activeDataset?.type === "house-price" &&
		activeDataset.id === `house-price${year}`;

	return (
		<PriceChart
			key={dataset.year}
			dataset={dataset}
			aggregatedData={aggregatedData}
			selectedArea={selectedArea}
			codeMapper={codeMapper}
			mappingGeneration={codeMapper?.getMappingGeneration() ?? 0}
			measure={measure}
			isActive={isActive}
			setActiveViz={setActiveViz}
		/>
	);
}
