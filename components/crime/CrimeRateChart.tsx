// components/crime/CrimeRateChart.tsx
'use client';
import { ActiveViz, AggregatedCrimeData, Dataset, CrimeDataset, SelectedArea } from '@lib/types';

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
	if (!dataset) return null;

	// Get income data for selected area or aggregated data
	let crimeRate: number | null = null;

	// We calculate data first so we can use it for the particle effects
	if (dataset) {
		if (selectedArea === null && aggregatedData) {
			crimeRate = aggregatedData[year]?.totalRecordedCrime || null;
		} else if (selectedArea && selectedArea.type === 'localAuthority' && selectedArea.data) {
			const laCode = selectedArea.code;
			crimeRate = dataset.records?.[laCode]?.totalRecordedCrime || null;

			// Try code mapping if not found
			if (!crimeRate && codeMapper) {
				const mappedCode = codeMapper.getCodeForYear('localAuthority', laCode, year);
				if (mappedCode) {
					crimeRate = dataset.records?.[mappedCode]?.totalRecordedCrime || null;
				}
			}
		}
	}

	const isActive = activeDataset?.id === `crime${dataset.year}`;

	return (
		<div
			className={`p-2 rounded transition-all duration-300 ease-in-out cursor-pointer overflow-hidden relative ${
				isActive ? `${colors.bg} border-2 ${colors.border}` : colors.inactive
			}`}
			onClick={() => setActiveViz({ 
				vizId: dataset.id, 
				datasetType: dataset.type, 
				datasetYear: dataset.year 
			})}
		>
			<div className="flex items-center justify-between mb-1.5 relative z-10">
				<h3 className="text-xs font-bold">Crime Rate [{dataset.year}]</h3>
			</div>

			<div className="relative flex justify-end items-end mt-4 z-10">
				<div className={`text-xl font-bold`}>
					{crimeRate}
				</div>
			</div>
		</div>
	);
}