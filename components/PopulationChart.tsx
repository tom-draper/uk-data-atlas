// components/PopulationChart.tsx
'use client';
import { PopulationChartProps } from '@lib/types';
import { usePopulationStats, useAgeData } from '@lib/hooks/usePopulationStats';
import PopulationSummary from '@components/population/PopulationSummary';
import NoDataView from '@components/population/NoDataView';
import AgeDistributionChart from '@components/population/AgeDistributionChart';
import GenderBreakdown from '@components/population/GenderBreakdown';
import GenderBalanceByAge from '@components/population/GenderBalanceByAge';

export default function PopulationChart({
	population,
	wardCode,
	wardName,
	wardCodeMap
}: PopulationChartProps) {
	const populationStats = usePopulationStats(population, wardCode, wardName, wardCodeMap);
	const ageData = useAgeData(population, wardCode, wardName, wardCodeMap);

	if (!populationStats) {
		return <NoDataView />;
	}

	const { total, males, females, ageGroups } = populationStats;

	return (
		<div className="space-y-3">
			<PopulationSummary total={total} males={males} females={females} />
			<AgeDistributionChart ageData={ageData} total={total} ageGroups={ageGroups.total} />
			{/* <GenderBreakdown ageGroups={ageGroups} /> */}
			<GenderBalanceByAge
				population={population}
				wardCode={wardCode}
				wardName={wardName}
				wardCodeMap={wardCodeMap}
			/>
		</div>
	);
}