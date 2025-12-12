// components/IncomeChart.tsx
'use client';
import { ActiveViz, AggregatedIncomeData, Dataset, IncomeDataset, SelectedArea } from '@lib/types';

interface IncomeChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, IncomeDataset>;
	aggregatedData: AggregatedIncomeData | null;
	selectedArea: SelectedArea | null;
	year: number;
	codeMapper?: {
		getCodeForYear: (type: 'localAuthority', code: string, targetYear: number) => string | undefined;
	};
	setActiveViz: (value: ActiveViz) => void;
}

const colors = {
	bg: 'bg-emerald-50/60',
	border: 'border-emerald-300',
	inactive: 'bg-white/60 border-2 border-gray-200/80 hover:border-emerald-300'
};

export default function IncomeChart({
	activeDataset,
	availableDatasets,
	selectedArea,
	year,
	codeMapper,
	setActiveViz,
}: IncomeChartProps) {
	const dataset = availableDatasets?.[year];
	if (!dataset) return null;

	const isActive = activeDataset?.id === `income${dataset.year}`;
	const hasData = selectedArea && selectedArea.type === 'localAuthority' && dataset.localAuthorityData?.[selectedArea.data.localAuthorityCode] !== undefined;

	return (
		<div
			className={`p-2 rounded transition-all duration-300 ease-in-out cursor-pointer overflow-hidden relative ${isActive ? `${colors.bg} border-2 ${colors.border}` : colors.inactive
				}`}
			onClick={() => setActiveViz({
				vizId: dataset.id,
				datasetType: dataset.type,
				datasetYear: dataset.year
			})}
		>
			<div className="flex items-center justify-between mb-1.5 relative z-10">
				<h3 className="text-xs font-bold">Income [{dataset.year}]</h3>
			</div>

			<div className="relative flex justify-end items-end mt-4 z-10">
				<div className={`text-xl font-bold ${!hasData ? 'text-gray-400 text-sm' : ''}`}>
					{hasData}
				</div>
			</div>
		</div>
	);
}