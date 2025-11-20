// components/PopulationChart.tsx
'use client';
import { ActiveViz, AggregatedPopulationData, PopulationDataset } from '@lib/types';
import PopulationDensity from '@/components/population/density/PopulationDensity';
import AgeChart from './population/age/AgeDistribution';
import Gender from './population/gender/Gender';
import { CodeMapper } from '@/lib/hooks/useCodeMapper';
import { BoundaryData } from '@/lib/hooks/useBoundaryData';

export interface PopulationChartProps {
	availableDatasets: Record<string, PopulationDataset>;
	aggregatedData: AggregatedPopulationData | null;
	boundaryData: BoundaryData;
	wardCode?: string;
	constituencyCode?: string;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	codeMapper: CodeMapper
}

export default function PopulationChart({
	availableDatasets,
	aggregatedData,
	boundaryData,
	wardCode,
	constituencyCode,
	activeViz,
	setActiveViz,
	codeMapper
}: PopulationChartProps) {
	return (
		<div className="pt-2.5 border-t border-gray-200/80">
			<h3 className="text-xs font-bold mb-2">Demographics</h3>
			<div className="space-y-3">
				<PopulationDensity
					activeViz={activeViz}
					setActiveViz={setActiveViz}
					dataset={availableDatasets[2022]}
					aggregatedData={aggregatedData}
					boundaryData={boundaryData}
					wardCode={wardCode}
					constituencyCode={constituencyCode}
					codeMapper={codeMapper}
				/>
				<AgeChart
					activeViz={activeViz}
					setActiveViz={setActiveViz}
					dataset={availableDatasets[2022]}
					aggregatedData={aggregatedData}
					wardCode={wardCode}
					constituencyCode={constituencyCode}
					codeMapper={codeMapper}
				/>
				<Gender
					activeViz={activeViz}
					setActiveViz={setActiveViz}
					dataset={availableDatasets[2022]}
					aggregatedData={aggregatedData}
					wardCode={wardCode}
					constituencyCode={constituencyCode}
					codeMapper={codeMapper}
				/>
			</div>
		</div>
	);
}