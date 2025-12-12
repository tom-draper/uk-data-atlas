// components/CrimeChart.tsx
'use client';
import { ActiveViz, AggregatedCrimeData, Dataset, CrimeDataset, SelectedArea } from '@lib/types';
import CrimeChart from './CrimeChart';

interface CrimeChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, CrimeDataset>;
	aggregatedData: AggregatedCrimeData | null;
	selectedArea: SelectedArea | null;
	codeMapper?: {
		getCodeForYear: (type: 'localAuthority', code: string, targetYear: number) => string | undefined;
	};
	setActiveViz: (value: ActiveViz) => void;
}

export default function CrimeSection({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	codeMapper,
	setActiveViz,
}: CrimeChartProps) {
	return (
		<div className="space-y-2 border-t border-gray-200/80">
			<h3 className="text-xs font-bold pt-2">Crime</h3>
			<CrimeChart
				activeDataset={activeDataset}
				availableDatasets={availableDatasets}
				aggregatedData={aggregatedData}
				year={2025}
				selectedArea={selectedArea}
				codeMapper={codeMapper}
				setActiveViz={setActiveViz}
			/>
		</div>
	);
}