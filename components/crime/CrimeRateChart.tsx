// components/crime/CrimeRateChart.tsx
'use client';
import { ActiveViz, AggregatedCrimeData, Dataset, CrimeDataset, SelectedArea } from '@lib/types';
import { useMemo } from 'react';

interface CrimeRateChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, CrimeDataset>;
	aggregatedData: AggregatedCrimeData | null;
	selectedArea: SelectedArea | null;
	codeMapper?: {
		getCodeForYear: (type: 'localAuthority', code: string, targetYear: number) => string | undefined;
	};
	year: number;
	setActiveViz: (value: ActiveViz) => void;
}

// Reverting to the original colors object for border styling
const colors = {
	bg: 'bg-emerald-50/60', // Note: We only use the base color for reference, the actual background is dynamic
	border: 'border-emerald-300',
	inactive: 'bg-white/60 border-2 border-gray-200/80 hover:border-emerald-300'
};

export default function CrimeRateChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	codeMapper,
	year,
	setActiveViz,
}: CrimeRateChartProps) {
	const dataset = availableDatasets?.[year];

	// --- Data Calculation ---
	const crimeRate = useMemo(() => {
		if (!dataset) return null;
		let rate: number | null = null;
		if (selectedArea === null && aggregatedData) {
			rate = aggregatedData[year]?.averageRecordedCrime || null;
		} else if (selectedArea && selectedArea.type === 'localAuthority' && selectedArea.data) {
			const laCode = selectedArea.code;
			rate = dataset.records?.[laCode]?.totalRecordedCrime || null;
			if (!rate && codeMapper) {
				const mappedCode = codeMapper.getCodeForYear('localAuthority', laCode, year);
				if (mappedCode) {
					rate = dataset.records?.[mappedCode]?.totalRecordedCrime || null;
				}
			}
		}
		return rate;
	}, [dataset, aggregatedData, selectedArea, codeMapper, year]);

	if (!dataset) return null;

	const isActive = activeDataset?.id === `crime${dataset.year}`;
	const formattedCrimeTotal = crimeRate ? Math.round(crimeRate).toLocaleString() : null;

	// --- HEATMAP LOGIC: INTENSITY, MIN/MAX THRESHOLDS ---

	const rawValue = crimeRate || 0;
	const maxThreshold = 100000;
	const minThreshold = 5000;

	// 1. Calculate Intensity (0 to 1) based on the min/max range
	let intensity = 0;
	const hasData = crimeRate !== null && crimeRate > 0;
	if (hasData && rawValue > minThreshold) {
		// Normalize the value within the range [minThreshold, maxThreshold]
		intensity = Math.min(Math.max((rawValue - minThreshold) / (maxThreshold - minThreshold), 0), 1);
	}
	// If rawValue <= 5000, intensity remains 0.

	// 2. Color Palettes (HSL) - Yellow to Orange to Red (better for crime data)
	// Hue: 50 (Yellow) -> 0 (Red)
	const baseHue = 50 - (intensity * 50); // Shifts from 50 (yellow) -> 0 (red)
	const hotHue = 50 - (intensity * 50);

	// Conditional container styles based on active state and original logic
	const containerClasses = `p-2 rounded transition-all duration-300 ease-in-out cursor-pointer overflow-hidden relative group ${isActive
			? `${colors.bg} border-2 ${colors.border}`
			: colors.inactive
		}`;

	// Calculate background color dynamically based on intensity
	// Only show color when we have actual data
	const dynamicBgColor = hasData 
		? `hsl(${baseHue}, ${40 + (intensity * 40)}%, ${95 - (intensity * 20)}%)` // Yellow->Orange->Red, Saturation 40%->80%, Lightness 95%->75%
		: 'rgb(255, 255, 255)'; // Pure white when no data

	return (
		<div
			className={containerClasses}
			style={{ backgroundColor: dynamicBgColor }} // Base color for full coverage
			onClick={() => setActiveViz({
				vizId: dataset.id,
				datasetType: dataset.type,
				datasetYear: dataset.year
			})}
		>
			{/* --- CONTOUR LAYERS --- */}
			{hasData && intensity > 0 && (
				<div className="absolute inset-0 z-0 overflow-hidden">
					<svg
						viewBox="0 0 100 100"
						preserveAspectRatio="none"
						className="w-full h-full opacity-80 transition-opacity duration-500"
					>
						<defs>
							<filter id="blurFilter">
								<feGaussianBlur in="SourceGraphic" stdDeviation="8" />
							</filter>
						</defs>

						{/* Layer 1: Outer/Base Layer - Widest, lightest */}
						<ellipse
							cx="50"
							cy="50"
							rx={45 + (intensity * 5)}
							ry={45 + (intensity * 5)}
							fill={`hsla(${hotHue + 20}, 60%, 70%, ${0.3 + (intensity * 0.2)})`}
							filter="url(#blurFilter)"
						/>

						{/* Layer 2: Mid Layer */}
						<ellipse
							cx="50"
							cy="50"
							rx={35 + (intensity * 5)}
							ry={35 + (intensity * 5)}
							fill={`hsla(${hotHue + 10}, 75%, 60%, ${0.4 + (intensity * 0.2)})`}
							filter="url(#blurFilter)"
						/>

						{/* Layer 3: Inner Layer - More intense */}
						<ellipse
							cx="50"
							cy="50"
							rx={25 + (intensity * 5)}
							ry={25 + (intensity * 5)}
							fill={`hsla(${hotHue + 5}, 85%, 55%, ${0.5 + (intensity * 0.2)})`}
							filter="url(#blurFilter)"
						/>

						{/* Layer 4: Core - Most intense, smallest */}
						<ellipse
							cx="50"
							cy="50"
							rx={15 + (intensity * 5)}
							ry={15 + (intensity * 5)}
							fill={`hsla(${hotHue}, 95%, 50%, ${0.6 + (intensity * 0.3)})`}
							filter="url(#blurFilter)"
						/>
					</svg>
				</div>
			)}

			{/* --- GLASS OVERLAY (Reduced blur for modern feel) --- */}
			<div className={`
                absolute inset-0 z-0 
                backdrop-blur-[1px] bg-white/20 
                transition-colors duration-300
                ${isActive ? 'bg-white/10' : 'group-hover:bg-white/40'}
            `} />

			{/* --- ORIGINAL CONTENT (Z-10) --- */}
			<div className="relative z-10">
				<div className="flex items-center justify-between mb-1.5 relative">
					<h3 className="text-xs font-bold text-gray-800/90 drop-shadow-sm">Recorded Crimes [{dataset.year}]</h3>
				</div>

				{formattedCrimeTotal ? (
					<div className="relative flex justify-center items-center mt-4 mb-2 z-10 h-5">
						<div className="text-xl font-bold text-gray-800 bg-transparent px-2 rounded drop-shadow-sm transition-colors duration-500"
							style={{
								// Text color adjusts based on intensity for readability
								color: intensity > 0.5 ? '#7f1d1d' : '#78350f' // Dark red for high intensity, dark orange otherwise
							}}
						>
							{formattedCrimeTotal}
						</div>
					</div>
				) : (
					<div className="h-7 mt-2 mb-2 relative z-10">
						<div className="text-xs text-gray-400/80 pt-0.5 text-center">No data available</div>
					</div>
				)}
			</div>
		</div>
	);
}