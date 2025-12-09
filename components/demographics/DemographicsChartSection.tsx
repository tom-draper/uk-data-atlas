// components/PopulationChart.tsx
'use client';
import { ActiveViz, AggregatedPopulationData, PopulationDataset } from '@lib/types';
import { CodeMapper } from '@/lib/hooks/useCodeMapper';
import { BoundaryData } from '@/lib/hooks/useBoundaryData';
import Gender from './gender/Gender';
import AgeDistribution from './age/AgeDistribution';
import PopulationDensity from './density/PopulationDensity';

export interface DemographicsChartSectionProps {
	availableDatasets: Record<string, PopulationDataset>;
	aggregatedData: AggregatedPopulationData | null;
	boundaryData: BoundaryData;
	wardCode?: string;
	constituencyCode?: string;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	codeMapper: CodeMapper
}

export default function DemographicsChartSection({
	availableDatasets,
	aggregatedData,
	boundaryData,
	wardCode,
	constituencyCode,
	activeViz,
	setActiveViz,
	codeMapper
}: DemographicsChartSectionProps) {
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
				<AgeDistribution
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