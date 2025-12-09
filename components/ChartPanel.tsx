// components/ChartPanel.tsx
'use client';
import packageJson from '../package.json';
import { Dataset, WardData, ConstituencyData, Datasets, ActiveViz, AggregatedData } from '@lib/types';
import LocalElectionResultChartSection from './local-election/LocalElectionResultChartSection';
import DemographicsChartSection from './demographics/DemographicsChartSection';
import { memo } from 'react';
import { CodeMapper } from '@/lib/hooks/useCodeMapper';
import { BoundaryData } from '@/lib/hooks/useBoundaryData';
import EconomicsSection from './economics/EconomicsSection';
import GeneralElectionResultChartSection from './general-election/GeneralElectionResultChartSection';
import CrimeSection from './crime/CrimeSection';

interface ChartPanelProps {
	selectedLocation: string | null;
	selectedWard: WardData | null;
	selectedConstituency: ConstituencyData | null;
	activeDataset: Dataset | null;
	boundaryData: BoundaryData;
	datasets: Datasets;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	aggregatedData: AggregatedData;
	codeMapper: CodeMapper
}

const PanelHeader = ({
	selectedLocation,
	selectedWard,
	selectedConstituency
}: {
	selectedLocation: string | null;
	selectedWard: WardData | null;
	selectedConstituency: ConstituencyData | null;
}) => {
	const { title, subtitle, code } = useLocationHeader(selectedLocation, selectedWard, selectedConstituency);

	return (
		<div className="pb-2 pt-2.5 px-2.5 bg-white/20">
			<h2 className="font-semibold text-sm">{title}</h2>
			<div className="text-gray-400/80 text-xs">
				{code ? (
					<div className="flex justify-between">
						<span>{subtitle}</span>
						<span>{code}</span>
					</div>
				) : subtitle}
			</div>
		</div>
	);
};

function useLocationHeader(selectedLocation: string | null, selectedWard: WardData | null, selectedConstituency: ConstituencyData | null) {
	if (selectedConstituency) {
		return {
			title: selectedConstituency.constituencyName,
			subtitle: `${selectedConstituency.regionName}, ${selectedConstituency.countryName}`,
			code: selectedConstituency.onsId
		};
	}

	if (selectedWard) {
		return {
			title: selectedWard.wardName,
			subtitle: selectedWard.localAuthorityName,
			code: `${selectedWard.localAuthorityCode} ${selectedWard.wardCode}`
		};
	}

	return {
		title: selectedLocation || 'Greater Manchester',
		subtitle: 'North West, England',
		code: ''
	};
}

const PanelFooter = () => {
	const version = packageJson.version;

	return (
		<div className="text-[9px] px-2.5 pb-1.5 text-gray-400/80 bg-white/20 pt-2 mt-auto flex">
			<a className="hover:underline cursor-pointer mr-auto" href="https://github.com/tom-draper/uk-data-atlas">
				UK Data Atlas v{version}
			</a>
			<a className="hover:underline cursor-pointer" href="/sources">
				View Sources
			</a>
		</div>
	);
};

export default memo(function ChartPanel({
	selectedLocation,
	selectedWard,
	selectedConstituency,
	activeDataset,
	boundaryData,
	datasets,
	activeViz,
	setActiveViz,
	aggregatedData,
	codeMapper
}: ChartPanelProps) {
	return (
		<div className="pointer-events-auto p-2.5 flex flex-col h-full w-[320px]">
			<div className="bg-[rgba(255,255,255,0.5)] rounded-md backdrop-blur-md shadow-lg h-full flex flex-col border border-white/30">
				<PanelHeader
					selectedLocation={selectedLocation}
					selectedWard={selectedWard}
					selectedConstituency={selectedConstituency}
				/>

				<div className="space-y-2.5 flex-1 px-2.5 overflow-y-auto scroll-container">
					<GeneralElectionResultChartSection
						activeDataset={activeDataset}
						availableDatasets={datasets.generalElection}
						aggregatedData={aggregatedData.generalElection}
						setActiveViz={setActiveViz}
						wardCode={selectedWard?.wardCode?.toString()}
						constituencyCode={selectedConstituency?.onsId}
						codeMapper={codeMapper}
					/>
					<LocalElectionResultChartSection
						activeDataset={activeDataset}
						availableDatasets={datasets.localElection}
						aggregatedData={aggregatedData.localElection}
						setActiveViz={setActiveViz}
						wardCode={selectedWard?.wardCode?.toString()}
						constituencyCode={selectedConstituency?.onsId}
						codeMapper={codeMapper}
					/>
					<DemographicsChartSection
						activeViz={activeViz}
						setActiveViz={setActiveViz}
						availableDatasets={datasets.population}
						aggregatedData={aggregatedData.population}
						boundaryData={boundaryData}
						wardCode={selectedWard?.wardCode?.toString()}
						constituencyCode={selectedConstituency?.onsId}
						codeMapper={codeMapper}
					/>
					<EconomicsSection
						activeDataset={activeDataset}
						availableHousePriceDatasets={datasets.housePrice}
						aggregatedHousePriceData={aggregatedData.housePrice}
						availableIncomeDatasets={datasets.income}
						aggregatedIncomeData={aggregatedData.income}
						setActiveViz={setActiveViz}
						wardCode={selectedWard?.wardCode?.toString()}
						constituencyCode={selectedConstituency?.onsId}
						codeMapper={codeMapper}
					/>
					<CrimeSection
						activeDataset={activeDataset}
						availableDatasets={datasets.crime}
						aggregatedData={aggregatedData.crime}
						setActiveViz={setActiveViz}
						wardCode={selectedWard?.wardCode?.toString()}
						constituencyCode={selectedConstituency?.onsId}
						codeMapper={codeMapper}
					/>
				</div>

				<PanelFooter />
			</div>
		</div>
	);
});