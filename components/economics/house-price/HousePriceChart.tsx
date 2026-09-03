// components/HousePriceChart.tsx
"use client";
import {
	ActiveViz,
	AggregatedHousePriceData,
	Dataset,
	HousePriceDataset,
	SelectedArea,
} from "@lib/types";
import React from "react";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import {
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { ChartCard } from "@/components/ChartCard";
import { useIsDark } from "@/lib/context/ThemeContext";

interface HousePriceChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, HousePriceDataset>;
	aggregatedData: Record<number, AggregatedHousePriceData> | null;
	year: number;
	selectedArea: SelectedArea | null;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

interface PriceChartProps {
	dataset: HousePriceDataset;
	aggregatedData: Record<number, AggregatedHousePriceData> | null;
	selectedArea: SelectedArea | null;
	getCodeForYear?: (
		type: "ward" | "localAuthority",
		code: string,
		targetYear: number,
	) => string | undefined;
	getWardsForLad?: (ladCode: string, year: number) => string[];
	getWardsForConstituency?: (
		constituencyCode: string,
		wardYear: number,
	) => string[];
	isActive: boolean;
	setActiveViz: (value: ActiveViz) => void;
}

const LINE_COLOR = "#6366f1"; // indigo-500

const housePriceLookupCache = new Map<string, Map<number, any>>();

function PriceChart({
	dataset,
	aggregatedData,
	selectedArea,
	getCodeForYear,
	getWardsForLad,
	getWardsForConstituency,
	isActive,
	setActiveViz,
}: PriceChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const { priceData, currentPrice } = (() => {
		let prices: Record<number, number> = {};
		let price2023: number | null = null;

		if (selectedArea === null && aggregatedData) {
			const yearAggregatedData = aggregatedData[dataset.year];
			if (yearAggregatedData) {
				// No area selected - show aggregated data
				prices = yearAggregatedData.averagePrices || {};
				price2023 = yearAggregatedData.averagePrice || null;
			}
		} else if (selectedArea && selectedArea.type === "ward") {
			// Ward selected - lookup ward data
			const wardCode = selectedArea.code;
			const cacheKey = `ward-${wardCode}`;
			if (!housePriceLookupCache.has(cacheKey)) {
				housePriceLookupCache.set(cacheKey, new Map());
			}
			const yearCache = housePriceLookupCache.get(cacheKey)!;

			if (yearCache.has(dataset.year)) {
				const cached = yearCache.get(dataset.year);
				prices = cached?.prices || {};
				price2023 = prices[2023] || null;
			} else {
				let data = dataset.data?.[wardCode];

				if (!data && getCodeForYear) {
					const mappedCode = getCodeForYear(
						"ward",
						wardCode,
						dataset.boundaryYear,
					);
					if (mappedCode) {
						data = dataset.data[mappedCode];
					}
				}

				if (data) {
					prices = data.prices;
					price2023 = prices[2023] || null;
				}

				// Cache the result
				yearCache.set(dataset.year, data || null);
			}
		} else if (
			selectedArea &&
			selectedArea.type === "localAuthority" &&
			getWardsForLad
		) {
			// Local Authority selected - aggregate ward data
			const ladCode = selectedArea.code;
			const cacheKey = `lad-${ladCode}`;

			if (!housePriceLookupCache.has(cacheKey)) {
				housePriceLookupCache.set(cacheKey, new Map());
			}
			const yearCache = housePriceLookupCache.get(cacheKey)!;

			if (yearCache.has(dataset.year)) {
				const cached = yearCache.get(dataset.year);
				prices = cached?.prices || {};
				price2023 = prices[2023] || null;
			} else {
				// Get all wards in this LAD
				const wardCodes = getWardsForLad(ladCode, 2022);

				if (wardCodes.length > 0) {
					// Aggregate prices across all wards
					const yearlyPrices: Record<number, number[]> = {};

					for (const wardCode of wardCodes) {
						let wardData = dataset.data?.[wardCode];

						// Try to map to the dataset's year if ward code doesn't exist
						if (!wardData && getCodeForYear) {
							const mappedCode = getCodeForYear(
								"ward",
								wardCode,
								2022,
							);
							if (mappedCode) {
								wardData = dataset.data[mappedCode];
							}
						}

						if (wardData?.prices) {
							// Collect prices by year
							for (const [year, price] of Object.entries(
								wardData.prices,
							)) {
								if (price !== null && price !== undefined) {
									const yearNum = Number(year);
									if (!yearlyPrices[yearNum]) {
										yearlyPrices[yearNum] = [];
									}
									yearlyPrices[yearNum].push(price as number);
								}
							}
						}
					}

					// Calculate median for each year
					for (const [year, priceArray] of Object.entries(
						yearlyPrices,
					)) {
						if (priceArray.length > 0) {
							// Sort and find median
							const sorted = priceArray.toSorted((a, b) => a - b);
							const mid = Math.floor(sorted.length / 2);
							prices[Number(year)] =
								sorted.length % 2 === 0
									? (sorted[mid - 1] + sorted[mid]) / 2
									: sorted[mid];
						}
					}

					price2023 = prices[2023] || null;
				}

				// Cache the result
				yearCache.set(dataset.year, { prices });
			}
		} else if (
			selectedArea &&
			selectedArea.type === "constituency" &&
			getWardsForConstituency
		) {
			// No cache — stale cache risks hiding data if computed before constituency-ward
			// mappings finish loading asynchronously
			const constituencyCode = selectedArea.code;
			const wardCodes = getWardsForConstituency(
				constituencyCode,
				dataset.boundaryYear,
			);
			if (wardCodes.length > 0) {
				const yearlyPrices: Record<number, number[]> = {};
				for (const wardCode of wardCodes) {
					let wardData = dataset.data?.[wardCode];
					if (!wardData && getCodeForYear) {
						const mapped = getCodeForYear(
							"ward",
							wardCode,
							dataset.boundaryYear,
						);
						if (mapped) wardData = dataset.data[mapped];
					}
					if (wardData?.prices) {
						for (const [year, price] of Object.entries(
							wardData.prices,
						)) {
							if (price !== null && price !== undefined) {
								const yearNum = Number(year);
								if (!yearlyPrices[yearNum])
									yearlyPrices[yearNum] = [];
								yearlyPrices[yearNum].push(price as number);
							}
						}
					}
				}
				for (const [year, priceArray] of Object.entries(yearlyPrices)) {
					if (priceArray.length > 0) {
						const sorted = priceArray.toSorted((a, b) => a - b);
						const mid = Math.floor(sorted.length / 2);
						prices[Number(year)] =
							sorted.length % 2 === 0
								? (sorted[mid - 1] + sorted[mid]) / 2
								: sorted[mid];
					}
				}
				price2023 = prices[2023] || null;
			}
		} else {
			// Other area types or missing mapper
			return {
				priceData: [],
				currentPrice: null,
			};
		}

		// Sort by year and filter out null values
		const sortedPrices = Object.entries(prices)
			.filter(([_, price]) => price !== null && price !== undefined)
			.sort(([a], [b]) => Number(a) - Number(b))
			.map(([year, price]) => ({
				year: Number(year),
				price: price as number,
			}));

		return {
			priceData: sortedPrices,
			currentPrice: price2023,
		};
	})();

	// Calculate SVG path for the line chart with straight lines
	const { linePath, areaPath } = (() => {
		if (priceData.length < 2) return { linePath: "", areaPath: "" };

		const width = 100;
		const height = 100;
		const maxPrice = 700000;
		const minPrice = 0;

		const calculatedPoints = priceData.map((d, i) => {
			const x = (i / (priceData.length - 1)) * width;
			const normalizedPrice = Math.min(d.price, maxPrice);
			const y =
				height -
				((normalizedPrice - minPrice) / (maxPrice - minPrice)) * height;
			return { x, y };
		});

		// Create straight line path
		const line = `M ${calculatedPoints.map((p) => `${p.x},${p.y}`).join(" L ")}`;

		// Create area path extending to bottom
		const area = `${line} L ${width},${height} L 0,${height} Z`;

		return { linePath: line, areaPath: area };
	})();

	const formattedPrice = currentPrice
		? `£${Math.round(currentPrice).toLocaleString()}`
		: null;

	return (
		<ChartCard
			heading={`Median House Price [${dataset.year}]`}
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
	activeViz,
	setActiveViz,
}: HousePriceChartProps) {
	const dataset = availableDatasets?.[year];
	if (!dataset) return null;

	const isActive =
		activeDataset &&
		((activeDataset.type === "housePrice" &&
			activeDataset.id === `housePrice${year}`) ||
			(activeViz.datasetType === "custom" &&
				activeViz.datasetId === "custom"));

	return (
		<PriceChart
			key={dataset.year}
			dataset={dataset}
			aggregatedData={aggregatedData}
			selectedArea={selectedArea}
			getCodeForYear={codeMapper?.getCodeForYear}
			getWardsForLad={codeMapper?.getWardsForLad}
			getWardsForConstituency={codeMapper?.getWardsForConstituency}
			isActive={isActive as boolean}
			setActiveViz={setActiveViz}
		/>
	);
}
