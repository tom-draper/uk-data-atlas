import { useMemo } from 'react';
import { useData } from '@lib/contexts/dataContext';
import ControlPanel from '@components/ControlPanel';
import LegendPanel from '@components/LegendPanel';
import ChartPanel from '@components/ChartPanel';
import type { ConstituencyData, LocalElectionWardData, BoundaryData, CodeMapper } from '@lib/types';

interface UIOverlayProps {
	selectedLocation: string;
	selectedWardData: LocalElectionWardData | null;
	selectedConstituencyData: ConstituencyData | null;
	boundaryData: BoundaryData;
	aggregatedData: {
		aggregatedLocalElectionData: Record<string, any>;
		aggregatedGeneralElectionData: Record<string, any>;
		aggregatedPopulationData: Record<string, any>;
		aggregatedHousePriceData: Record<string, any>;
	} | null;
	codeMapper: CodeMapper;
	mapOptions: any;
	onMapOptionsChange: (options: any) => void;
	onLocationClick: (location: string) => void;
}

export default function UIOverlay({
	selectedLocation,
	selectedWardData,
	selectedConstituencyData,
	boundaryData,
	aggregatedData,
	codeMapper,
	mapOptions,
	onMapOptionsChange,
	onLocationClick,
}: UIOverlayProps) {
	const {
		datasets,
		activeDatasetId,
		activeDataset,
		setActiveDatasetId,
	} = useData();

	// Destructure aggregatedData with fallbacks
	const {
		aggregatedLocalElectionData = {},
		aggregatedGeneralElectionData = {},
		aggregatedPopulationData = {},
		aggregatedHousePriceData = {},
	} = aggregatedData || {};

	// Get current aggregated data for active dataset
	const currentAggregatedData = useMemo(() => {
		if (!activeDataset) return null;
		
		const aggregatedMap = {
			'local-election': aggregatedLocalElectionData,
			'general-election': aggregatedGeneralElectionData,
			'population': aggregatedPopulationData,
			'house-price': aggregatedHousePriceData,
		};

		return aggregatedMap[activeDataset.type]?.[activeDataset.year] ?? null;
	}, [
		activeDataset,
		aggregatedLocalElectionData,
		aggregatedGeneralElectionData,
		aggregatedPopulationData,
		aggregatedHousePriceData,
	]);

	return (
		<div className="fixed inset-0 z-50 h-full w-full pointer-events-none">
			<div className="absolute left-0 flex h-full">
				<ControlPanel
					selectedLocation={selectedLocation}
					onLocationClick={onLocationClick}
					population={datasets.population?.['population-2022']?.populationData ?? {}}
				/>
			</div>

			<div className="absolute right-0 flex h-full">
				<LegendPanel
					activeDatasetId={activeDatasetId}
					activeDataset={activeDataset}
					aggregatedData={currentAggregatedData}
					mapOptions={mapOptions}
					onMapOptionsChange={onMapOptionsChange}
				/>
				<ChartPanel
					selectedLocation={selectedLocation}
					selectedWard={selectedWardData}
					selectedConstituency={selectedConstituencyData}
					activeDatasetId={activeDatasetId}
					activeDataset={activeDataset}
					boundaryData={boundaryData}
					localElectionDatasets={datasets['local-election']}
					generalElectionDatasets={datasets['general-election']}
					populationDatasets={datasets.population}
					housePriceDatasets={datasets['house-price']}
					setActiveDatasetId={setActiveDatasetId}
					aggregatedLocalElectionData={aggregatedLocalElectionData}
					aggregatedGeneralElectionData={aggregatedGeneralElectionData}
					aggregatedPopulationData={aggregatedPopulationData}
					aggregatedHousePriceData={aggregatedHousePriceData}
					codeMapper={codeMapper}
				/>
			</div>
		</div>
	);
}