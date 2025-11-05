// components/PopulationChart.tsx
'use client';
import { Dataset, PopulationWardData } from '@lib/types';
import { usePopulationStats, useAgeData } from '@lib/hooks/usePopulationStats';
import PopulationSummary from '@components/population/PopulationSummary';
import AgeChart from './population/AgeChart';
import GenderChart from './population/GenderChart';
import { GeneralElectionDataset } from '@/lib/hooks/useGeneralElectionData';

export interface PopulationChartProps {
	activeDataset: GeneralElectionDataset | Dataset;
	availableDatasets: Record<string, Dataset>;
	wardCode: string;
	wardName: string;
	setActiveDatasetId: (datasetId: string) => void;
}

export default function PopulationChart({
	activeDataset,
	availableDatasets,
	wardCode,
	wardName,
	setActiveDatasetId
}: PopulationChartProps) {
	const population = availableDatasets['population']?.populationData || {};
	const populationStats = usePopulationStats(population, wardCode, wardName);
	const ageData = useAgeData(population, wardCode, wardName);

	const total = populationStats?.total || 0;
	const males = populationStats?.males || 0;
	const females = populationStats?.females || 0;
	const ageGroups = populationStats?.ageGroups || { total: { '0-17': 0, '18-29': 0, '30-44': 0, '45-64': 0, '65+': 0 } };

	return (
		<div className="pt-2.5 border-t border-gray-200/80">
			<h3 className="text-xs font-bold text-gray-700 mb-2">Demographics</h3>
			<div className="space-y-3">
				<PopulationSummary
					activeDataset={activeDataset}
					total={total}
					males={males}
					females={females}
					setActiveDatasetId={setActiveDatasetId}
				/>
				<AgeChart
					activeDataset={activeDataset}
					ageData={ageData}
					total={total}
					ageGroups={ageGroups.total}
					setActiveDatasetId={setActiveDatasetId}
				/>
				<GenderChart
					activeDataset={activeDataset}
					population={population}
					wardCode={wardCode}
					wardName={wardName}
					setActiveDatasetId={setActiveDatasetId}
				/>
			</div>
		</div>
	);
}