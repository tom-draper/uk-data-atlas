// components/CrimeChart.tsx
'use client';
import { CodeMapper } from '@/lib/hooks/useCodeMapper';
import { ActiveViz, AggregatedCrimeData, Dataset, CrimeDataset } from '@lib/types';
import CrimeChart from './CrimeChart';

interface CrimeChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, CrimeDataset>;
	setActiveViz: (value: ActiveViz) => void;
	wardCode?: string;
	constituencyCode?: string;
	aggregatedData: AggregatedCrimeData | null;
	codeMapper: CodeMapper;
}

export default function CrimeSection({
	activeDataset,
	availableDatasets,
	setActiveViz,
	wardCode,
	constituencyCode,
	aggregatedData,
	codeMapper,
}: CrimeChartProps) {
	return (
		<div className="space-y-2 border-t border-gray-200/80">
			<h3 className="text-xs font-bold pt-2">Crime</h3>
			<CrimeChart
				activeDataset={activeDataset}
				availableDatasets={availableDatasets}
				aggregatedData={aggregatedData}
				year={2025}
				setActiveViz={setActiveViz}
				wardCode={wardCode}
				constituencyCode={constituencyCode}
				codeMapper={codeMapper}
			/>
		</div>
	);
}