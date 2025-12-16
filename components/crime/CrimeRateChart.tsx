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
	if (rawValue > minThreshold) {
		// Normalize the value within the range [minThreshold, maxThreshold]
		intensity = Math.min(Math.max((rawValue - minThreshold) / (maxThreshold - minThreshold), 0), 1);
	}
	// If rawValue <= 5000, intensity remains 0.

	// 2. Color Palettes (HSL) - INCREASED INTENSITY/VIVIDNESS
	// Hue: 150 (Emerald) -> 0 (Red)
	const baseHue = 150 - (intensity * 150); // Shifts from 150 -> 0
	const hotHue = 150 - (intensity * 150);

	// Dynamic rotation for organic shape
	// Keep consistent for the duration of the component lifecycle
	const rotationA = useMemo(() => Math.floor(Math.random() * 360), []);
	const rotationB = useMemo(() => Math.floor(Math.random() * 360), []);

	// Organic Blob Paths (Normalized 0-100 coordinates)
	const blobPaths = [
		"M45,-20 C65,-10, 85,5, 88,30 C91,55, 75,85, 50,88 C25,91, 5,75, -5,50 C-15,25, 10,-10, 45,-20 Z",
		"M50,10 C70,15, 80,40, 75,60 C70,80, 50,95, 30,85 C10,75, 5,50, 20,30 C35,10, 40,8, 50,10 Z"
	];


	// Conditional container styles based on active state and original logic
	const containerClasses = `p-2 rounded transition-all duration-300 ease-in-out cursor-pointer overflow-hidden relative group ${isActive
			? `${colors.bg} border-2 ${colors.border}`
			: colors.inactive
		}`;

	// Calculate background color dynamically based on intensity
	const dynamicBgColor = `hsl(${baseHue}, ${70 + (intensity * 30)}%, ${96 - (intensity * 15)}%)`; // Saturation 70%->100%, Lightness 96%->81%

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
			<div className="absolute inset-0 z-0 overflow-hidden">
				<svg
					viewBox="0 0 100 100"
					preserveAspectRatio="none"
					// Zoomed in SVG to ensure edges bleed off
					className="w-[150%] h-[150%] -translate-x-1/4 -translate-y-1/4 opacity-90 transition-opacity duration-500"
				>
					<defs>
						<filter id="blurFilter">
							<feGaussianBlur in="SourceGraphic" stdDeviation="6" />
						</filter>
					</defs>

					{/* Layer 2: Mid-Heat Contour - Only visible above minThreshold */}
					{intensity > 0 && (
						<path
							d={blobPaths[0]}
							fill={`hsla(${hotHue + 10}, 95%, 65%, 0.7)`} // High saturation
							filter="url(#blurFilter)"
							transform={`rotate(${rotationA} 50 50)`}
							style={{
								transformOrigin: 'center',
								scale: 0.8 + (intensity * 0.5)
							}}
						/>
					)}

					{/* Layer 3: Core Heat Contour (Center) - Only visible above minThreshold */}
					{intensity > 0 && (
						<path
							d={blobPaths[1]}
							fill={`hsla(${hotHue}, 100%, 55%, 0.8)`} // Full saturation, darker center
							filter="url(#blurFilter)"
							transform={`rotate(${rotationB} 50 50)`}
							style={{
								transformOrigin: 'center',
								scale: 0.5 + (intensity * 0.6)
							}}
						/>
					)}
				</svg>
			</div>

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
								// Text color gets darker/redder to contrast with the light heat glow
								color: `hsl(${baseHue - 40}, 60%, 25%)`
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