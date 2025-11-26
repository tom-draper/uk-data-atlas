// components/HousePriceChart.tsx
'use client';
import { CodeMapper } from '@/lib/hooks/useCodeMapper';
import { ActiveViz, AggregatedCrimeData, Dataset, CrimeDataset } from '@lib/types';
import React from 'react';

interface CrimeChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, CrimeDataset>;
	setActiveViz: (value: ActiveViz) => void;
	wardCode?: string;
	constituencyCode?: string;
	aggregatedData: AggregatedCrimeData | null;
	codeMapper: CodeMapper
}

interface CrimeActivityProps {
	dataset: CrimeDataset;
	wardCode?: string;
	constituencyCode?: string;
	aggregatedData: AggregatedCrimeData | null;
	isActive: boolean;
	setActiveViz: (value: ActiveViz) => void;
	codeMapper: CodeMapper;
}

// Move year colors outside component to avoid recreating on each render
const YEAR_COLORS: Record<string, { bg: string; border: string; badge: string; text: string; line: string }> = {
	'2023': { bg: 'bg-emerald-50/60', border: 'border-emerald-300', badge: 'bg-emerald-300 text-emerald-900', text: 'bg-emerald-200 text-emerald-800', line: '#10b981' },
};

const CrimeActivityChart = React.memo(({ dataset, wardCode, constituencyCode, isActive, aggregatedData, setActiveViz, codeMapper }: CrimeActivityProps) => {
	const colors = YEAR_COLORS[dataset.year] || YEAR_COLORS['2023'];

	return (
		<div
			className={`p-2 rounded transition-all duration-300 ease-in-out cursor-pointer overflow-hidden relative ${isActive
				? `${colors.bg} border-2 ${colors.border}`
				: 'bg-white/60 border-2 border-gray-200/80 hover:border-emerald-300'
				}`}
			onClick={() => setActiveViz({ vizId: dataset.id, datasetType: dataset.type, datasetYear: dataset.year })}
		>
			<div className="flex items-center justify-between mb-1.5 relative z-10">
				<h3 className="text-xs font-bold">Crime [{dataset.year}]</h3>
			</div>

			{/* Price display in bottom right */}
			<div className="relative flex justify-end items-end mt-4 z-10">
				<div className={`text-xl font-bold ${!dataset.records ? 'text-gray-400 text-sm' : ''}`}>
					{dataset.records[wardCode || constituencyCode || ''] !== undefined}
				</div>
			</div>
		</div>
	);
});
CrimeActivityChart.displayName = 'CrimeActivityChart';

export default function CrimeChart({
	activeDataset,
	availableDatasets,
	setActiveViz,
	wardCode,
	constituencyCode,
	aggregatedData,
	codeMapper,
}: CrimeChartProps) {
	if (!availableDatasets) return null;

	const dataset = availableDatasets[2025];
	if (!dataset) {
		return null;
	}

	const isActive = activeDataset?.id === 'crime2025';

	return (
		<div className="space-y-2 border-t border-gray-200/80">
			<h3 className="text-xs font-bold pt-2">Crime</h3>
			<CrimeActivityChart
				key={dataset.year}
				dataset={dataset}
				isActive={isActive}
				wardCode={wardCode}
				constituencyCode={constituencyCode}
				aggregatedData={aggregatedData}
				setActiveViz={setActiveViz}
				codeMapper={codeMapper}
			/>
		</div>
	);
};