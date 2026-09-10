"use client";

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
import { useIsDark } from "@/lib/context/ThemeContext";

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

	const { linePath, areaPath } = (() => {
		if (priceData.length < 2) return { linePath: "", areaPath: "" };

		const width = 100;
		const height = 100;
		const maxPrice = 700000;
		const minPrice = 0;
		const calculatedPoints = priceData.map((datum, index) => {
			const x = (index / (priceData.length - 1)) * width;
			const normalizedPrice = Math.min(datum.price, maxPrice);
			const y =
				height -
				((normalizedPrice - minPrice) / (maxPrice - minPrice)) * height;
			return { x, y };
		});
		const line = `M ${calculatedPoints.map((point) => `${point.x},${point.y}`).join(" L ")}`;
		return {
			linePath: line,
			areaPath: `${line} L ${width},${height} L 0,${height} Z`,
		};
	})();

	const formattedPrice = currentPrice
		? `£${Math.round(currentPrice).toLocaleString()}`
		: null;

	return (
		<ChartCard
			heading={`${measure === "mean" ? "Mean" : "Median"} House Price [${dataset.year}]`}
			accent={LINE_COLOR}
			isActive={isActive}
			title="Office for National Statistics. UK House Price Index (HPI): Mean and Median House Prices by Local Authority. ons.gov.uk"
			onClick={() =>
				setActiveViz({
					datasetId: dataset.id,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
			background={
				priceData.length >= 2 &&
				linePath && (
					<svg
						className="absolute inset-0 size-full"
						viewBox="0 0 100 100"
						preserveAspectRatio="none"
					>
						<defs>
							<linearGradient
								id={`gradient-${dataset.year}`}
								x1="0%"
								y1="0%"
								x2="0%"
								y2="100%"
							>
								<stop
									offset="0%"
									stopColor={LINE_COLOR}
									stopOpacity="0.1"
								/>
								<stop
									offset="100%"
									stopColor={LINE_COLOR}
									stopOpacity="0.05"
								/>
							</linearGradient>
						</defs>
						<path
							d={areaPath}
							fill={`url(#gradient-${dataset.year})`}
						/>
						<path
							d={linePath}
							fill="none"
							stroke={LINE_COLOR}
							strokeWidth="2.5"
							strokeLinecap="round"
							strokeLinejoin="round"
							vectorEffect="non-scaling-stroke"
						/>
					</svg>
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
	const measure = useCurrentMapOptions().housePrice.measure;
	const dataset = availableDatasets?.[year];
	if (!dataset) return null;

	const isActive =
		activeDataset?.type === "housePrice" &&
		activeDataset.id === `housePrice${year}`;

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
