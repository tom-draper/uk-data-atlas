// components/ChartPanel.tsx
'use client';
import { AllYearsAggregatedData, Dataset, PopulationWardData, WardData } from '@lib/types';
import { ConstituencyData } from '@/lib/hooks/useGeneralElectionData';
import LocalElectionResultChart from './LocalElectionResultChart';
import PopulationChart from './PopulationChart';
import GeneralElectionResultChart from './GeneralElectionResultChart';
import { memo } from 'react';

interface ChartPanelProps {
	selectedLocation: string | null;
	selectedWard: WardData | null;
	selectedConstituency: ConstituencyData | null;
	population: PopulationWardData;
	activeDataset: Dataset;
	localElectionDatasets: Dataset[];
	generalElectionDatasets: any[];
	onDatasetChange: (datasetId: string) => void;
	aggregatedData: AllYearsAggregatedData;
	wardCodeMap: { [name: string]: string };
}

export default memo(function ChartPanel({
	selectedLocation,
	selectedWard,
	selectedConstituency,
	population,
	activeDataset,
	localElectionDatasets,
	generalElectionDatasets,
	onDatasetChange,
	aggregatedData,
	wardCodeMap
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
					<div className="text-gray-500 text-xs">
						{code ? (
							<div className="flex justify-between">
								<span>{subtitle}</span>
								<span className="font-mono text-[10px]">{code}</span>
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
						onDatasetChange={onDatasetChange}
						constituencyId={selectedConstituency?.onsId}
					/>
					
					<LocalElectionResultChart
						activeDataset={activeDataset}
						availableDatasets={localElectionDatasets}
						onDatasetChange={onDatasetChange}
						wardCode={selectedWard?.wardCode?.toString() ?? ''}
						aggregatedData={aggregatedData}
					/>
					
					<PopulationChart
						population={population}
						wardCode={selectedWard?.wardCode?.toString() ?? ''}
						wardName={selectedWard?.wardName?.toString() || ''}
						wardCodeMap={wardCodeMap}
						onDatasetChange={onDatasetChange}
						activeDataset={activeDataset}
					/>
				</div>

				{/* Footer */}
				<div className="text-[9px] px-2.5 pb-2 text-gray-400 bg-white/20 pt-2 mt-auto">
					Click to switch which dataset shows on map
				</div>
			</div>
		</div>
	);
});