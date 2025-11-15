// components/ChartPanel.tsx
'use client';
import { AggregatedLocalElectionData, AggregateGeneralElectionData, Dataset, LocalElectionWardData, LocalElectionDataset, PopulationDataset, GeneralElectionDataset, ConstituencyData, AggregatedPopulationData } from '@lib/types';
import LocalElectionResultChart from './LocalElectionResultChart';
import PopulationChart from './PopulationChart';
import GeneralElectionResultChart from './GeneralElectionResultChart';
import { memo } from 'react';
import { CodeMapper } from '@/lib/hooks/useCodeMapper';
import { BoundaryData } from '@/lib/hooks/useBoundaryData';

interface ChartPanelProps {
	selectedLocation: string | null;
	selectedWard: LocalElectionWardData | null;
	selectedConstituency: ConstituencyData | null;
	activeDatasetId: string;
	activeDataset: Dataset;
	boundaryData: BoundaryData;
	localElectionDatasets: Record<string, LocalElectionDataset>;
	generalElectionDatasets: Record<string, GeneralElectionDataset>;
	populationDatasets: Record<string, PopulationDataset>;
	setActiveDatasetId: (datasetId: string) => void;
	aggregatedLocalElectionData: AggregatedLocalElectionData | null;
	aggregatedGeneralElectionData: AggregateGeneralElectionData | null;
	aggregatedPopulationData: AggregatedPopulationData | null;
	codeMapper: CodeMapper
}

export default memo(function ChartPanel({
	selectedLocation,
	selectedWard,
	selectedConstituency,
	activeDatasetId,
	activeDataset,
	boundaryData,
	localElectionDatasets,
	generalElectionDatasets,
	populationDatasets,
	setActiveDatasetId,
	aggregatedLocalElectionData,
	aggregatedGeneralElectionData,
	aggregatedPopulationData,
	codeMapper
}: ChartPanelProps) {
	// Determine what to show in the title
	let title = selectedLocation || 'Greater Manchester';
	let subtitle = 'North West, England';
	let code = '';

	if (selectedConstituency) {
		title = selectedConstituency.constituencyName;
		subtitle = `${selectedConstituency.regionName}, ${selectedConstituency.countryName}`;
		code = selectedConstituency.onsId;
	} else if (selectedWard) {
		title = selectedWard.wardName;
		subtitle = selectedWard.localAuthorityName;
		code = `${selectedWard.localAuthorityCode} ${selectedWard.wardCode}`;
	}

	return (
		<div className="pointer-events-auto p-2.5 flex flex-col h-full w-[320px]">
			<div className="bg-[rgba(255,255,255,0.5)] rounded-md backdrop-blur-md shadow-lg h-full flex flex-col border border-white/30">
				{/* Header */}
				<div className="pb-2 pt-2.5 px-2.5 bg-white/20">
					<h2 className="font-semibold text-sm">{title}</h2>
					<div className="text-gray-400/80 text-xs">
						{code ? (
							<div className="flex justify-between">
								<span>{subtitle}</span>
								<span>{code}</span>
							</div>
						) : (
							subtitle
						)}
					</div>
				</div>

				{/* Main Content Area */}
				<div className="space-y-2.5 flex-1 px-2.5 overflow-y-auto scroll-container">
					<GeneralElectionResultChart
						activeDataset={activeDataset}
						availableDatasets={generalElectionDatasets}
						aggregatedData={aggregatedGeneralElectionData}
						setActiveDatasetId={setActiveDatasetId}
						wardCode={selectedWard?.wardCode?.toString()}
						constituencyCode={selectedConstituency?.onsId}
						codeMapper={codeMapper}
					/>

					<LocalElectionResultChart
						activeDataset={activeDataset}
						availableDatasets={localElectionDatasets}
						aggregatedData={aggregatedLocalElectionData}
						setActiveDatasetId={setActiveDatasetId}
						wardCode={selectedWard?.wardCode?.toString()}
						constituencyCode={selectedConstituency?.onsId}
						codeMapper={codeMapper}
					/>

					<PopulationChart
						activeDatasetId={activeDatasetId}
						availableDatasets={populationDatasets}
						aggregatedData={aggregatedPopulationData}
						setActiveDatasetId={setActiveDatasetId}
						boundaryData={boundaryData}
						wardCode={selectedWard?.wardCode?.toString()}
						constituencyCode={selectedConstituency?.onsId}
						codeMapper={codeMapper}
					/>

				</div>

				{/* Footer */}
				<div className="text-[9px] px-2.5 pb-1.5 text-gray-400/80 bg-white/20 pt-2 mt-auto flex">
					<div className="grow hover:underline cursor-pointer">
						UK Data Atlas
					</div>
					<div className="hover:underline cursor-pointer">
						View Sources
					</div>
				</div>
			</div>
		</div>
	);
});