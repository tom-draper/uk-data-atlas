// components/PopulationChart.tsx
'use client';
import { Dataset, PopulationWardData } from '@lib/types';
import { usePopulationStats, useAgeData } from '@lib/hooks/usePopulationStats';
import PopulationSummary from '@components/population/PopulationSummary';
import NoDataView from '@components/population/NoDataView';
import AgeDistributionChart from '@components/population/AgeDistributionChart';
import GenderBalanceByAge from '@components/population/GenderBalanceByAge';

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

	if (!populationStats) {
		return <NoDataView />;
	}

	const { total, males, females, ageGroups } = populationStats;

	return (
		<div className="space-y-3">
			<PopulationSummary total={total} males={males} females={females} onDatasetChange={onDatasetChange} activeDataset={activeDataset} />
			<AgeDistributionChart ageData={ageData} total={total} ageGroups={ageGroups.total} />
			<GenderBalanceByAge
				population={population}
				wardCode={wardCode}
				wardName={wardName}
				wardCodeMap={wardCodeMap}
			/>
		</div>
	);
}