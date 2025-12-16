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

const colors = {
	bg: 'bg-emerald-50/60',
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

	// --- HEATMAP LOGIC ---
	const rawValue = crimeRate || 0;
	const maxThreshold = 100000;
	const minThreshold = 5000;

	let intensity = 0;
	const hasData = crimeRate !== null && crimeRate > 0;
	if (hasData && rawValue > minThreshold) {
		intensity = Math.min(Math.max((rawValue - minThreshold) / (maxThreshold - minThreshold), 0), 1);
	}

	// Yellow to Orange to Red
	const baseHue = 50 - (intensity * 50);
	const hotHue = 50 - (intensity * 50);

	// Organic contour paths - memoized for performance
	const contourPaths = useMemo(() => [
		// Layer 1: Outermost, widest contour
		"M10,50 Q15,20 40,15 T70,15 Q85,20 90,50 T85,80 Q70,88 40,85 T15,80 Q10,65 10,50 Z",
		// Layer 2: Mid-outer contour
		"M20,50 Q23,28 42,23 T65,24 Q78,30 80,50 T76,72 Q65,80 42,78 T24,70 Q20,60 20,50 Z",
		// Layer 3: Mid-inner contour
		"M30,50 Q32,35 45,32 T60,33 Q70,38 72,50 T68,65 Q60,72 45,70 T32,63 Q30,57 30,50 Z",
		// Layer 4: Inner contour
		"M38,50 Q40,40 48,38 T58,39 Q64,42 66,50 T62,60 Q58,65 48,64 T40,58 Q38,54 38,50 Z",
		// Layer 5: Core hotspot
		"M43,50 Q44,44 50,43 T56,44 Q59,46 60,50 T58,56 Q56,59 50,58 T44,55 Q43,53 43,50 Z"
	], []);

	const containerClasses = `p-2 rounded transition-all duration-300 ease-in-out cursor-pointer overflow-hidden relative group ${isActive
			? `${colors.bg} border-2 ${colors.border}`
			: colors.inactive
		}`;

	const dynamicBgColor = hasData 
		? `hsl(${baseHue}, ${40 + (intensity * 40)}%, ${95 - (intensity * 20)}%)`
		: 'rgb(255, 255, 255)';

	return (
		<div
			className={containerClasses}
			style={{ backgroundColor: dynamicBgColor }}
			onClick={() => setActiveViz({
				vizId: dataset.id,
				datasetType: dataset.type,
				datasetYear: dataset.year
			})}
		>
			{/* --- CONTOUR LAYERS --- */}
			{hasData && intensity > 0 && (
				<div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
					<svg
						viewBox="0 0 100 100"
						preserveAspectRatio="none"
						className="w-full h-full will-change-auto"
					>
						<defs>
							<filter id="softBlur">
								<feGaussianBlur in="SourceGraphic" stdDeviation="2" />
							</filter>
						</defs>

						{/* Layer 1: Outermost - Pale, widest */}
						<path
							d={contourPaths[0]}
							fill={`hsla(${hotHue + 25}, 55%, 75%, ${0.25 + (intensity * 0.15)})`}
							filter="url(#softBlur)"
							style={{ transform: `scale(${1 + (intensity * 0.1)})`, transformOrigin: 'center' }}
						/>

						{/* Layer 2: Mid-outer */}
						<path
							d={contourPaths[1]}
							fill={`hsla(${hotHue + 18}, 65%, 68%, ${0.35 + (intensity * 0.15)})`}
							filter="url(#softBlur)"
							style={{ transform: `scale(${1 + (intensity * 0.08)})`, transformOrigin: 'center' }}
						/>

						{/* Layer 3: Mid-inner */}
						<path
							d={contourPaths[2]}
							fill={`hsla(${hotHue + 12}, 75%, 60%, ${0.45 + (intensity * 0.15)})`}
							filter="url(#softBlur)"
							style={{ transform: `scale(${1 + (intensity * 0.06)})`, transformOrigin: 'center' }}
						/>

						{/* Layer 4: Inner */}
						<path
							d={contourPaths[3]}
							fill={`hsla(${hotHue + 6}, 85%, 52%, ${0.55 + (intensity * 0.15)})`}
							filter="url(#softBlur)"
							style={{ transform: `scale(${1 + (intensity * 0.04)})`, transformOrigin: 'center' }}
						/>

						{/* Layer 5: Core hotspot */}
						<path
							d={contourPaths[4]}
							fill={`hsla(${hotHue}, 95%, 45%, ${0.65 + (intensity * 0.2)})`}
							filter="url(#softBlur)"
							style={{ transform: `scale(${1 + (intensity * 0.02)})`, transformOrigin: 'center' }}
						/>
					</svg>
				</div>
			)}

			{/* --- GLASS OVERLAY --- */}
			<div className={`
                absolute inset-0 z-0 pointer-events-none
                backdrop-blur-[0.5px] bg-white/20 
                transition-colors duration-300
                ${isActive ? 'bg-white/10' : 'group-hover:bg-white/40'}
            `} />

			{/* --- CONTENT --- */}
			<div className="relative z-10">
				<div className="flex items-center justify-between mb-1.5 relative">
					<h3 className="text-xs font-bold text-gray-800/90 drop-shadow-sm">Recorded Crimes [{dataset.year}]</h3>
				</div>

				{formattedCrimeTotal ? (
					<div className="relative flex justify-center items-center mt-4 mb-2 z-10 h-5">
						<div className="text-xl font-bold text-gray-800 bg-transparent px-2 rounded drop-shadow-sm transition-colors duration-300"
							style={{
								color: intensity > 0.5 ? '#7f1d1d' : '#78350f'
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