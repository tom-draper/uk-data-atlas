// components/HousePriceChart.tsx
'use client';
import { ActiveViz, AggregatedHousePriceData, Dataset, HousePriceDataset, SelectedArea } from '@lib/types';
import React, { useMemo } from 'react';

interface HousePriceChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, HousePriceDataset>;
	aggregatedData: AggregatedHousePriceData | null;
	year: number;
	selectedArea: SelectedArea | null;
	setActiveViz: (value: ActiveViz) => void;
}

interface PriceChartProps {
	dataset: HousePriceDataset;
	aggregatedData: AggregatedHousePriceData | null;
	selectedArea: SelectedArea | null;
	isActive: boolean;
	setActiveViz: (value: ActiveViz) => void;
}

const colors = {
	bg: 'bg-emerald-50/60', 
	border: 'border-emerald-300', 
	badge: 'bg-emerald-300 text-emerald-900', 
	text: 'bg-emerald-200 text-emerald-800', 
	line: '#10b981'
};

// Cache for ward/constituency lookups
const housePriceLookupCache = new Map<string, Map<number, any>>();

const PriceChart = React.memo(({ dataset, aggregatedData, selectedArea, isActive, setActiveViz }: PriceChartProps) => {
	const { priceData, currentPrice } = useMemo(() => {
		let prices: Record<number, number> = {};
		let price2023: number | null = null;

		if (selectedArea === null && aggregatedData) {
			prices = aggregatedData[2023]?.averagePrices || {};
			price2023 = aggregatedData[2023]?.averagePrice || null;
		} else if (selectedArea && selectedArea.type === 'ward') {
			// Check cache first
			const wardCode = selectedArea.data.wardCode;
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
				// Try direct lookup first
				const data = dataset.wardData?.[wardCode];

				if (data) {
					prices = data.prices;
					price2023 = prices[2023] || null;
				}

				// Cache the result
				yearCache.set(dataset.year, data || null);
			}
		} else {
			// House prices are ward-level data only, return empty
			return {
				priceData: [],
				currentPrice: null
			};
		}

		// Sort by year and filter out null values
		const sortedPrices = Object.entries(prices)
			.filter(([_, price]) => price !== null && price !== undefined)
			.sort(([a], [b]) => Number(a) - Number(b))
			.map(([year, price]) => ({ year: Number(year), price: price as number }));

		return {
			priceData: sortedPrices,
			currentPrice: price2023
		};
	}, [dataset, aggregatedData, selectedArea]);

	// Calculate SVG path for the line chart with straight lines
	const { linePath, areaPath } = useMemo(() => {
		if (priceData.length < 2) return { linePath: '', areaPath: '' };

		const width = 100;
		const height = 100;
		const maxPrice = 700000;
		const minPrice = 0;

		const calculatedPoints = priceData.map((d, i) => {
			const x = (i / (priceData.length - 1)) * width;
			const normalizedPrice = Math.min(d.price, maxPrice);
			const y = height - ((normalizedPrice - minPrice) / (maxPrice - minPrice)) * height;
			return { x, y };
		});

		// Create straight line path
		const line = `M ${calculatedPoints.map(p => `${p.x},${p.y}`).join(' L ')}`;

		// Create area path extending to bottom
		const area = `${line} L ${width},${height} L 0,${height} Z`;

		return { linePath: line, areaPath: area };
	}, [priceData]);

	const formattedPrice = currentPrice
		? `£${Math.round(currentPrice).toLocaleString()}`
		: null;

	return (
		<div
			className={`p-2 rounded transition-all duration-300 ease-in-out cursor-pointer overflow-hidden relative ${isActive
				? `${colors.bg} border-2 ${colors.border}`
				: 'bg-white/60 border-2 border-gray-200/80 hover:border-emerald-300'
				}`}
			onClick={() => setActiveViz({ vizId: dataset.id, datasetType: dataset.type, datasetYear: dataset.year })}
		>
			<div className="flex items-center justify-between mb-1.5 relative z-10">
				<h3 className="text-xs font-bold">House Price [{dataset.year}]</h3>
			</div>

			{/* Line chart background */}
			{priceData.length >= 2 && linePath && (
				<svg
					className="absolute inset-0 w-full h-full"
					viewBox="0 0 100 100"
					preserveAspectRatio="none"
				>
					<defs>
						<linearGradient id={`gradient-${dataset.year}`} x1="0%" y1="0%" x2="0%" y2="100%">
							<stop offset="0%" stopColor={colors.line} stopOpacity="0.08" />
							<stop offset="100%" stopColor={colors.line} stopOpacity="0.08" />
						</linearGradient>
					</defs>

					{/* Solid faint area under the line */}
					<path
						d={areaPath}
						fill={`url(#gradient-${dataset.year})`}
					/>

					{/* Main smooth line */}
					<path
						d={linePath}
						fill="none"
						stroke={colors.line}
						strokeWidth="2.5"
						strokeLinecap="round"
						strokeLinejoin="round"
						vectorEffect="non-scaling-stroke"
					/>
				</svg>
			)}

			{/* Price display in bottom right */}
			{formattedPrice ? (
				<div className="relative flex justify-end items-end mt-4 z-10 h-7">
					<div className={`text-xl font-bold ${!currentPrice ? 'text-gray-400 text-sm' : ''}`}>
						{formattedPrice}
					</div>
				</div>
			) : (
				<div className="h-7 mt-3 mb-1">
					<div className="text-xs text-gray-400/80 pt-0.5 text-center">No data available</div>
				</div>
			)}
		</div>
	);
});
PriceChart.displayName = 'PriceChart';

export default function HousePriceChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	year,
	selectedArea,
	setActiveViz,
}: HousePriceChartProps) {
	const dataset = availableDatasets?.[year];
	if (!dataset) return null;

	const isActive = activeDataset?.id === `housePrice${year}`;

	return (
		<PriceChart
			key={dataset.year}
			dataset={dataset}
			aggregatedData={aggregatedData}
			selectedArea={selectedArea}
			isActive={isActive}
			setActiveViz={setActiveViz}
		/>
	);
};