// components/ChartPanel.tsx
'use client';
import { ChartData, Dataset, PopulationWardData } from '@/lib/types';
import { LocalElectionResultChart } from './LocalElectionResultChart';
import { PopulationChart } from './PopulationChart';

interface AllYearsWardData {
	data2024: { [wardCode: string]: any };
	data2023: { [wardCode: string]: any };
	data2022: { [wardCode: string]: any };
	data2021: { [wardCode: string]: any };
}

interface AllYearsAggregatedData {
	data2024: ChartData | null;
	data2023: ChartData | null;
	data2022: ChartData | null;
	data2021: ChartData | null;
}

interface ChartPanelProps {
	title: string;
	wardCode: string;
	wardData: AllYearsWardData | null;
	population: PopulationWardData;
	activeDataset: Dataset;
	availableDatasets: Dataset[];
	onDatasetChange: (datasetId: string) => void;
	aggregatedData: AllYearsAggregatedData;
	wardCodeMap: { [name: string]: string };
}

export const ChartPanel = ({
	title,
	wardCode,
	wardData,
	population,
	activeDataset,
	availableDatasets,
	onDatasetChange,
	aggregatedData,
	wardCodeMap
}: ChartPanelProps) => {
	return (
		<div className="pointer-events-auto p-[10px] flex flex-col h-full w-[320px]">
			<div className="bg-[rgba(255,255,255,0.6)] rounded-md backdrop-blur-md shadow-lg h-[100%] p-3 flex flex-col overflow-y-auto">
				{/* Header */}
				<div className="pb-2 border-b border-gray-200">
					<h2 className="font-semibold text-sm">{title}</h2>
					<div className="text-gray-500 text-xs">
						{wardCode ? (
							<div className="flex space-x-1">
								<span className="flex-grow">Ward selected</span>
								<span>{wardCode}</span>
							</div>
						) : 'North West, England'}
					</div>
				</div>
				{/* Main Content Area */}
				<div className="space-y-2 flex-1 overflow-y-auto">
					{/* Election Results Section */}
					<LocalElectionResultChart
						activeDataset={activeDataset}
						availableDatasets={availableDatasets}
						onDatasetChange={onDatasetChange}
						wardCode={wardCode}
						wardData={wardData}
                        aggregatedData={aggregatedData}
					/>
					{/* Population Section */}
					<div className="pt-3 border-t border-gray-200">
						<h3 className="text-xs font-bold text-gray-700 mb-2">Population (Mid-2020)</h3>
						<PopulationChart
							population={population}
							wardCode={wardCode}
							wardName={title}
							wardCodeMap={wardCodeMap}
						/>
					</div>
				</div>
				{/* Footer */}
				<div className="text-[9px] text-gray-400 pt-2 border-t border-gray-200 mt-auto">
					Click to switch which dataset shows on map
				</div>
			</div>
		</div>
	);
};