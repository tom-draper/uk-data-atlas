// components/PopulationChart.tsx
'use client';
import { AggregatedPopulationData, BoundaryGeojson, PopulationDataset } from '@lib/types';
import PopulationDensity from '@/components/population/density/PopulationDensity';
import AgeChart from './population/age/AgeDistribution';
import Gender from './population/gender/Gender';
import { CodeMapper } from '@/lib/hooks/useCodeMapper';

export interface PopulationChartProps {
	activeDatasetId: string;
	availableDatasets: Record<string, PopulationDataset>;
	aggregatedData: AggregatedPopulationData | null;
	geojson: BoundaryGeojson | null;
	wardCode: string;
	setActiveDatasetId: (datasetId: string) => void;
	codeMapper: CodeMapper
}

export default function PopulationChart({
	activeDatasetId,
	availableDatasets,
	aggregatedData,
	geojson,
	wardCode,
	setActiveDatasetId,
	codeMapper
}: PopulationChartProps) {
	const dataset = availableDatasets['population'] || {};

	return (
		<div className="pt-2.5 border-t border-gray-200/80">
			<h3 className="text-xs font-bold text-gray-700 mb-2">Demographics</h3>
			<div className="space-y-3">
				<PopulationDensity
					activeDatasetId={activeDatasetId}
					setActiveDatasetId={setActiveDatasetId}
					aggregatedData={aggregatedData}
					geojson={geojson}
					wardCode={wardCode}
				/>
				<AgeChart
					activeDatasetId={activeDatasetId}
					setActiveDatasetId={setActiveDatasetId}
					aggregatedData={aggregatedData}
					dataset={dataset}
					wardCode={wardCode}
					codeMapper={codeMapper}
				/>
				<Gender
					activeDatasetId={activeDatasetId}
					setActiveDatasetId={setActiveDatasetId}
					dataset={dataset}
					aggregatedData={aggregatedData}
					wardCode={wardCode}
					codeMapper={codeMapper}
				/> 
			</div>
		</div>
	);
}