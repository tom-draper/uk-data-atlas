// components/PopulationChart.tsx
'use client';
import { AggregatedPopulationData, PopulationDataset } from '@lib/types';
import PopulationDensity from '@/components/population/density/PopulationDensity';
import AgeChart from './population/age/AgeDistribution';
import Gender from './population/gender/Gender';
import { CodeMapper } from '@/lib/hooks/useCodeMapper';
import { BoundaryData } from '@/lib/hooks/useBoundaryData';

export interface PopulationChartProps {
	activeDatasetId: string;
	availableDatasets: Record<string, PopulationDataset>;
	aggregatedData: AggregatedPopulationData | null;
	boundaryData: BoundaryData;
	wardCode?: string;
	constituencyCode?: string;
	setActiveDatasetId: (datasetId: string) => void;
	codeMapper: CodeMapper
}

export default function PopulationChart({
	activeDatasetId,
	availableDatasets,
	aggregatedData,
	boundaryData,
	wardCode,
	constituencyCode,
	setActiveDatasetId,
	codeMapper
}: PopulationChartProps) {
	return (
		<div className="pt-2.5 border-t border-gray-200/80">
			<h3 className="text-xs font-bold text-gray-700 mb-2">Demographics</h3>
			<div className="space-y-3">
				<PopulationDensity
					activeDatasetId={activeDatasetId}
					setActiveDatasetId={setActiveDatasetId}
					dataset={availableDatasets['population-2022']}
					aggregatedData={aggregatedData}
					boundaryData={boundaryData}
					wardCode={wardCode}
					constituencyCode={constituencyCode}
					codeMapper={codeMapper}
				/>
				<PopulationDensity
					activeDatasetId={activeDatasetId}
					setActiveDatasetId={setActiveDatasetId}
					dataset={availableDatasets['population-2021']}
					aggregatedData={aggregatedData}
					boundaryData={boundaryData}
					wardCode={wardCode}
					constituencyCode={constituencyCode}
					codeMapper={codeMapper}
				/>

				<AgeChart
					activeDatasetId={activeDatasetId}
					setActiveDatasetId={setActiveDatasetId}
					dataset={availableDatasets['population-2022']}
					aggregatedData={aggregatedData}
					wardCode={wardCode}
					constituencyCode={constituencyCode}
					codeMapper={codeMapper}
				/>
				<AgeChart
					activeDatasetId={activeDatasetId}
					setActiveDatasetId={setActiveDatasetId}
					dataset={availableDatasets['population-2021']}
					aggregatedData={aggregatedData}
					wardCode={wardCode}
					constituencyCode={constituencyCode}
					codeMapper={codeMapper}
				/>

				<Gender
					activeDatasetId={activeDatasetId}
					setActiveDatasetId={setActiveDatasetId}
					dataset={availableDatasets['population-2022']}
					aggregatedData={aggregatedData}
					wardCode={wardCode}
					constituencyCode={constituencyCode}
					codeMapper={codeMapper}
				/>
				<Gender
					activeDatasetId={activeDatasetId}
					setActiveDatasetId={setActiveDatasetId}
					dataset={availableDatasets['population-2021']}
					aggregatedData={aggregatedData}
					wardCode={wardCode}
					constituencyCode={constituencyCode}
					codeMapper={codeMapper}
				/>
			</div>
		</div>
	);
}