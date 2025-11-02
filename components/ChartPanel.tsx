// components/ChartPanel.tsx
'use client';
import { AllYearsAggregatedData, Dataset, PopulationWardData, WardData } from '@lib/types';
import LocalElectionResultChart from './LocalElectionResultChart';
import PopulationChart from './PopulationChart';
import { memo } from 'react';
import GeneralElectionResultChart from './GeneralElectionResultChart copy';

interface ChartPanelProps {
	selectedLocation: string | null;
	selectedWard: WardData | null;
	population: PopulationWardData;
	activeDataset: Dataset;
	availableDatasets: Dataset[];
	onDatasetChange: (datasetId: string) => void;
	aggregatedData: AllYearsAggregatedData;
	wardCodeMap: { [name: string]: string };
}

export default memo(function ChartPanel({
	selectedLocation,
	selectedWard,
	population,
	activeDataset,
	availableDatasets,
	onDatasetChange,
	aggregatedData,
	wardCodeMap
}: ChartPanelProps) {
	const title = selectedWard?.wardName || selectedLocation || 'Greater Manchester';

	return (
		<div className="pointer-events-auto p-2.5 flex flex-col h-full w-[320px]">
			<div className="bg-[rgba(255,255,255,0.5)] rounded-md backdrop-blur-md shadow-lg h-full flex flex-col border border-white/30">
				{/* Header */}
				<div className="pb-2 pt-2.5 px-2.5 bg-white/20">
					<h2 className="font-semibold text-sm">{title}</h2>
					<div className="text-gray-500 text-xs">
						{selectedWard?.wardCode ? (
							<div className="flex space-x-1">
								<span className="grow">{selectedWard?.localAuthorityName}</span>
								<span>{selectedWard?.localAuthorityCode}</span>
								<span>{selectedWard?.wardCode}</span>
							</div>
						) : 'North West, England'}
					</div>
				</div>
				{/* Main Content Area */}
				<div className="space-y-2.5 flex-1 px-2.5 overflow-y-auto scroll-container">
					<GeneralElectionResultChart
						activeDataset={activeDataset}
						availableDatasets={availableDatasets}
						onDatasetChange={onDatasetChange}
						wardCode={selectedWard?.wardCode?.toString() ?? ''}
                        aggregatedData={aggregatedData}
					/>
					<LocalElectionResultChart
						activeDataset={activeDataset}
						availableDatasets={availableDatasets}
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