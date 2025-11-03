// components/PopulationChart.tsx
'use client';
import { Dataset, PopulationWardData } from '@lib/types';
import { usePopulationStats, useAgeData } from '@lib/hooks/usePopulationStats';
import PopulationSummary from '@components/population/PopulationSummary';
import AgeDistributionChart from '@components/population/AgeDistributionChart';
import GenderBalanceByAge from '@components/population/GenderBalanceByAge';
import AgeChart from './population/AgeChart';
import GenderChart from './population/GenderChart';

export interface PopulationChartProps {
	population: PopulationWardData;
	wardCode: string;
	wardName: string;
	wardCodeMap: { [name: string]: string };
	onDatasetChange: (datasetId: string) => void;
	activeDataset: Dataset;
}

export default function PopulationChart({
	population,
	wardCode,
	wardName,
	wardCodeMap,
	onDatasetChange,
	activeDataset
}: PopulationChartProps) {
	const populationStats = usePopulationStats(population, wardCode, wardName, wardCodeMap);
	const ageData = useAgeData(population, wardCode, wardName, wardCodeMap);

	const total = populationStats?.total || 0;
	const males = populationStats?.males || 0;
	const females = populationStats?.females || 0;
	const ageGroups = populationStats?.ageGroups || { total: { '0-17': 0, '18-29': 0, '30-44': 0, '45-64': 0, '65+': 0 } };

	return (
		<div className="pt-2.5 border-t border-gray-200/80">
			<h3 className="text-xs font-bold text-gray-700 mb-2">Demographics</h3>
			<div className="space-y-3">
				<PopulationSummary 
					total={total} 
					males={males} 
					females={females} 
					onDatasetChange={onDatasetChange} 
					activeDataset={activeDataset}
				/>
				<AgeChart 
					ageData={ageData} 
					total={total} 
					ageGroups={ageGroups.total} 
					onDatasetChange={onDatasetChange} 
					activeDataset={activeDataset}
				/>
				<GenderChart 
					population={population} 
					wardCode={wardCode} 
					wardName={wardName} 
					wardCodeMap={wardCodeMap} 
					onDatasetChange={onDatasetChange} 
					activeDataset={activeDataset}
				/>
			</div>
		</div>
	);
}