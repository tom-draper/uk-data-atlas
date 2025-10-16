// components/ChartPanel.tsx
'use client';
import { AllYearsAggregatedData, Dataset, PopulationWardData, WardData } from '@/lib/types';
import LocalElectionResultChart from './LocalElectionResultChart';
import PopulationChart from './PopulationChart';
import { memo } from 'react';

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
		<div className="pointer-events-auto p-[10px] flex flex-col h-full w-[320px]">
			<div className="bg-[rgba(255,255,255,0.6)] rounded-md backdrop-blur-md shadow-lg h-[100%] flex flex-col">
				{/* Header */}
				<div className="pb-2 pt-[10px] px-[10px] border-b border-gray-200">
					<h2 className="font-semibold text-sm">{title}</h2>
					<div className="text-gray-500 text-xs">
						{selectedWard?.wardCode ? (
							<div className="flex space-x-1">
								<span className="flex-grow">{selectedWard?.localAuthorityName}</span>
								<span>{selectedWard?.localAuthorityCode}</span>
								<span>{selectedWard?.wardCode}</span>
							</div>
						) : 'North West, England'}
					</div>
				</div>
				{/* Main Content Area */}
				<div className="space-y-2 flex-1 px-[10px] overflow-y-auto scroll-container">
					{/* Election Results Section */}
					<LocalElectionResultChart
						activeDataset={activeDataset}
						availableDatasets={availableDatasets}
						onDatasetChange={onDatasetChange}
						wardCode={selectedWard?.wardCode.toString() ?? ''}
                        aggregatedData={aggregatedData}
					/>
					{/* Population Section */}
					<div className="pt-3 border-t border-gray-200">
						{/* <h3 className="text-xs font-bold text-gray-700 mb-2">Population (Mid-2020)</h3> */}
						<PopulationChart
							population={population}
							wardCode={selectedWard?.wardCode.toString() ?? ''}
							wardName={selectedWard?.wardName.toString() || ''}
							wardCodeMap={wardCodeMap}
						/>
					</div>
				</div>
				{/* Footer */}
				<div className="text-[9px] px-[10px] pb-[10px] text-gray-400 pt-2 border-t border-gray-200 mt-auto">
					Click to switch which dataset shows on map
				</div>
			</div>
		</div>
	);
});