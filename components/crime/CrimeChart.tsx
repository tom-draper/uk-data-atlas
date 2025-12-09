// components/CrimeChart.tsx
'use client';
import { CodeMapper } from '@/lib/hooks/useCodeMapper';
import { ActiveViz, AggregatedCrimeData, Dataset, CrimeDataset } from '@lib/types';

interface CrimeChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, CrimeDataset>;
	setActiveViz: (value: ActiveViz) => void;
	year: number;
	wardCode?: string;
	constituencyCode?: string;
	aggregatedData: AggregatedCrimeData | null;
	codeMapper: CodeMapper;
}

const COLORS = {
	bg: 'bg-emerald-50/60',
	border: 'border-emerald-300',
	inactive: 'bg-white/60 border-2 border-gray-200/80 hover:border-emerald-300'
};

export default function CrimeChart({
	activeDataset,
	availableDatasets,
	year,
	setActiveViz,
	wardCode,
	constituencyCode,
}: CrimeChartProps) {
	const dataset = availableDatasets?.[year];
	if (!dataset) return null;

	const isActive = activeDataset?.id === `crime${dataset.year}`;
	const areaCode = wardCode || constituencyCode || '';
	const hasData = dataset.records?.[areaCode] !== undefined;

	return (
		<div
			className={`p-2 rounded transition-all duration-300 ease-in-out cursor-pointer overflow-hidden relative ${
				isActive ? `${COLORS.bg} border-2 ${COLORS.border}` : COLORS.inactive
			}`}
			onClick={() => setActiveViz({ 
				vizId: dataset.id, 
				datasetType: dataset.type, 
				datasetYear: dataset.year 
			})}
		>
			<div className="flex items-center justify-between mb-1.5 relative z-10">
				<h3 className="text-xs font-bold">Crime [{dataset.year}]</h3>
			</div>

			<div className="relative flex justify-end items-end mt-4 z-10">
				<div className={`text-xl font-bold ${!hasData ? 'text-gray-400 text-sm' : ''}`}>
					{hasData}
				</div>
			</div>
		</div>
	);
}