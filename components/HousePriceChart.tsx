// components/HousePriceChart.tsx
'use client';
import { CodeMapper } from '@/lib/hooks/useCodeMapper';
import { AggregatedHousePriceData, Dataset, HousePriceDataset } from '@lib/types';
import React, { useCallback, useMemo } from 'react';

interface HousePriceChartProps {
	activeDataset: Dataset;
	availableDatasets: Record<string, HousePriceDataset | null>;
	setActiveDatasetId: (datasetId: string) => void;
	wardCode?: string;
	constituencyCode?: string;
	aggregatedData: AggregatedHousePriceData | null;
	codeMapper: CodeMapper
}

interface PriceChartProps {
	dataset: HousePriceDataset;
	wardCode?: string;
	constituencyCode?: string;
	aggregatedData: AggregatedHousePriceData | null;
	isActive: boolean;
	setActiveDatasetId: (datasetId: string) => void;
}

// Move year colors outside component to avoid recreating on each render
const YEAR_COLORS: Record<string, { bg: string; border: string; badge: string; text: string; line: string }> = {
	'2024': { bg: 'bg-blue-50/60', border: 'border-blue-300', badge: 'bg-blue-300 text-blue-900', text: 'bg-blue-200 text-blue-800', line: '#3b82f6' },
	'2023': { bg: 'bg-amber-50/60', border: 'border-amber-300', badge: 'bg-amber-300 text-amber-900', text: 'bg-amber-200 text-amber-800', line: '#f59e0b' },
	'2022': { bg: 'bg-purple-50/60', border: 'border-purple-300', badge: 'bg-purple-300 text-purple-900', text: 'bg-purple-200 text-purple-800', line: '#a855f7' },
	'2021': { bg: 'bg-emerald-50/60', border: 'border-emerald-300', badge: 'bg-emerald-300 text-emerald-900', text: 'bg-emerald-200 text-emerald-800', line: '#10b981' },
};

const PriceChart = React.memo(({ dataset, wardCode, constituencyCode, isActive, aggregatedData, setActiveDatasetId }: PriceChartProps) => {
	const colors = YEAR_COLORS[dataset.year] || YEAR_COLORS['2024'];

	const handleClick = useCallback(() => {
		setActiveDatasetId(dataset.id);
	}, [setActiveDatasetId, dataset.id]);

	// Get price data for the chart
	const { priceData, currentPrice } = useMemo(() => {
		let prices: Record<number, number> = {};
		let price2023: number | null = null;

		if (wardCode && dataset.wardData[wardCode]) {
			prices = dataset.wardData[wardCode].prices;
			price2023 = prices[2023];
		} else if (!wardCode && aggregatedData) {
			prices = aggregatedData[2023]?.averagePrices || {};
			price2023 = aggregatedData[2023]?.averagePrice || null;
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
	}, [wardCode, dataset, aggregatedData]);

	// Calculate SVG path for the line chart with gradient area
	const { linePath, areaPath } = useMemo(() => {
		if (priceData.length < 2) return { linePath: '', areaPath: '' };

		const width = 100;
		const height = 60;
		const padding = 5;
		const maxPrice = 700000;
		const minPrice = 0;

		const points = priceData.map((d, i) => {
			const x = padding + (i / (priceData.length - 1)) * (width - 2 * padding);
			const normalizedPrice = Math.min(d.price, maxPrice);
			const y = height - padding - ((normalizedPrice - minPrice) / (maxPrice - minPrice)) * (height - 2 * padding);
			return { x, y };
		});

		const line = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
		
		// Create area path (same as line but closed at bottom)
		const area = `M ${padding},${height - padding} L ${points.map(p => `${p.x},${p.y}`).join(' L ')} L ${width - padding},${height - padding} Z`;

		return { linePath: line, areaPath: area };
	}, [priceData]);

	const formattedPrice = currentPrice 
		? `£${Math.round(currentPrice).toLocaleString()}`
		: 'N/A';

	return (
		<div
			className={`p-2 rounded transition-all duration-300 ease-in-out cursor-pointer overflow-hidden relative ${isActive
				? `${colors.bg} border-2 ${colors.border}`
				: 'bg-white/60 border-2 border-gray-200/80 hover:border-blue-300'
				}`}
			onClick={handleClick}
		>
			<div className="flex items-center justify-between mb-1.5">
				<h3 className="text-xs font-bold">House Prices {dataset.year}</h3>
			</div>

			{/* Line chart background with gradient */}
			{priceData.length >= 2 && (
				<svg 
					className="absolute inset-0 w-full h-full" 
					viewBox="0 0 100 60" 
					preserveAspectRatio="none"
				>
					<defs>
						<linearGradient id={`gradient-${dataset.year}`} x1="0%" y1="0%" x2="0%" y2="100%">
							<stop offset="0%" stopColor={colors.line} stopOpacity="0.3" />
							<stop offset="100%" stopColor={colors.line} stopOpacity="0.05" />
						</linearGradient>
						<filter id={`glow-${dataset.year}`}>
							<feGaussianBlur stdDeviation="0.5" result="coloredBlur"/>
							<feMerge>
								<feMergeNode in="coloredBlur"/>
								<feMergeNode in="SourceGraphic"/>
							</feMerge>
						</filter>
					</defs>
					
					{/* Gradient area under the line */}
					<path
						d={areaPath}
						fill={`url(#gradient-${dataset.year})`}
					/>
					
					{/* Main line with glow effect */}
					<path
						d={linePath}
						fill="none"
						stroke={colors.line}
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						filter={`url(#glow-${dataset.year})`}
						vectorEffect="non-scaling-stroke"
					/>
					
					{/* Data points */}
					{priceData.map((d, i) => {
						const width = 100;
						const height = 60;
						const padding = 5;
						const maxPrice = 700000;
						const minPrice = 0;
						const x = padding + (i / (priceData.length - 1)) * (width - 2 * padding);
						const normalizedPrice = Math.min(d.price, maxPrice);
						const y = height - padding - ((normalizedPrice - minPrice) / (maxPrice - minPrice)) * (height - 2 * padding);
						
						return (
							<circle
								key={i}
								cx={x}
								cy={y}
								r="1.5"
								fill={colors.line}
								opacity="0.8"
							/>
						);
					})}
				</svg>
			)}

			{/* Price display in bottom right */}
			<div className="relative flex justify-end items-end mt-4">
				<div className="text-xl font-bold">
					{formattedPrice}
				</div>
			</div>
		</div>
	);
});
PriceChart.displayName = 'PriceChart';

export default function HousePriceChart({
	activeDataset,
	availableDatasets,
	setActiveDatasetId,
	wardCode,
	constituencyCode,
	aggregatedData,
	codeMapper,
}: HousePriceChartProps) {
	if (!availableDatasets) return null;
	const datasetId = `house-price-2023`
	const dataset = availableDatasets[datasetId];
	if (!dataset) {
		return null;
	}

	const isActive = activeDataset.id === datasetId;

	return (
		<div className="space-y-2 border-t border-gray-200/80">
			<h3 className="text-xs font-bold text-gray-700 pt-2">House Price</h3>
			<PriceChart
				key={dataset.year}
				dataset={dataset}
				isActive={isActive}
				wardCode={wardCode}
				constituencyCode={constituencyCode}
				aggregatedData={aggregatedData}
				setActiveDatasetId={setActiveDatasetId}
			/>
		</div>
	);
};