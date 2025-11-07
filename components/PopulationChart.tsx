// components/PopulationChart.tsx
'use client';
import { Dataset, PopulationDataset } from '@lib/types';
import { usePopulationStats, useAgeData } from '@lib/hooks/usePopulationStats';
import PopulationSummary from '@components/population/PopulationSummary';
import AgeChart from './population/AgeChart';
import GenderChart from './population/GenderChart';
import { WardCodeMapper } from '@/lib/hooks/useWardCodeMapper';

export interface PopulationChartProps {
	activeDatasetId: string;
	availableDatasets: Record<string, PopulationDataset>;
	wardCode: string;
	wardName: string;
	setActiveDatasetId: (datasetId: string) => void;
	wardCodeMapper: WardCodeMapper
}

export default function PopulationChart({
	activeDatasetId,
	availableDatasets,
	wardCode,
	wardName,
	setActiveDatasetId,
	wardCodeMapper
}: PopulationChartProps) {
	const population = availableDatasets['population']?.populationData || {};
	const populationStats = usePopulationStats(population, wardCode, wardName, wardCodeMapper);
	const ageData = useAgeData(population, wardCode, wardName, wardCodeMapper);

	const total = populationStats?.total || 0;
	const males = populationStats?.males || 0;
	const females = populationStats?.females || 0;
	const ageGroups = populationStats?.ageGroups || { total: { '0-17': 0, '18-29': 0, '30-44': 0, '45-64': 0, '65+': 0 } };

	return (
		<div className="pt-2.5 border-t border-gray-200/80">
			<h3 className="text-xs font-bold text-gray-700 mb-2">Demographics</h3>
			<div className="space-y-3">
				<PopulationSummary
					activeDatasetId={activeDatasetId}
					setActiveDatasetId={setActiveDatasetId}
					total={total}
					males={males}
					females={females}
				/>
				<AgeChart
					activeDatasetId={activeDatasetId}
					setActiveDatasetId={setActiveDatasetId}
					ageData={ageData}
					total={total}
					ageGroups={ageGroups.total}
				/>
				<GenderChart
				 	activeDatasetId={activeDatasetId}
					setActiveDatasetId={setActiveDatasetId}
					population={population}
					wardCode={wardCode}
					wardCodeMapper={wardCodeMapper}
				/>
			</div>
		</div>
	);
}