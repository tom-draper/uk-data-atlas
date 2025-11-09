// components/PopulationChart.tsx
'use client';
import { BoundaryGeojson, PopulationDataset } from '@lib/types';
import { usePopulationStats, useAgeData } from '@lib/hooks/usePopulationStats';
import PopulationDensity from '@/components/population/density/PopulationDensity';
import AgeChart from './population/age/AgeDistribution';
import Gender from './population/gender/Gender';
import { CodeMapper } from '@/lib/hooks/useCodeMapper';

export interface PopulationChartProps {
	activeDatasetId: string;
	availableDatasets: Record<string, PopulationDataset>;
	geojson: BoundaryGeojson | null;
	wardCode: string;
	wardName: string;
	setActiveDatasetId: (datasetId: string) => void;
	codeMapper: CodeMapper
}

export default function PopulationChart({
	activeDatasetId,
	availableDatasets,
	geojson,
	wardCode,
	wardName,
	setActiveDatasetId,
	codeMapper
}: PopulationChartProps) {
	const population = availableDatasets['population']?.populationData || {};
	const populationStats = usePopulationStats(population, wardCode, wardName, codeMapper);
	const ageData = useAgeData(population, wardCode, wardName, codeMapper);

	const total = populationStats?.total || 0;
	const ageGroups = populationStats?.ageGroups || { total: { '0-17': 0, '18-29': 0, '30-44': 0, '45-64': 0, '65+': 0 } };

	return (
		<div className="pt-2.5 border-t border-gray-200/80">
			<h3 className="text-xs font-bold text-gray-700 mb-2">Demographics</h3>
			<div className="space-y-3">
				<PopulationDensity
					activeDatasetId={activeDatasetId}
					setActiveDatasetId={setActiveDatasetId}
					geojson={geojson}
					wardCode={wardCode}
					total={total}
				/>
				<AgeChart
					activeDatasetId={activeDatasetId}
					setActiveDatasetId={setActiveDatasetId}
					ageData={ageData}
					total={total}
					ageGroups={ageGroups.total}
				/>
				<Gender
					activeDatasetId={activeDatasetId}
					setActiveDatasetId={setActiveDatasetId}
					population={population}
					wardCode={wardCode}
					codeMapper={codeMapper}
				/>
			</div>
		</div>
	);
}