import ControlPanel from '@components/ControlPanel';
import LegendPanel from '@components/LegendPanel';
import ChartPanel from '@components/ChartPanel';
import type { ActiveViz, ConstituencyData, Dataset, Datasets, LocalElectionWardData } from '@lib/types';
import { CodeMapper } from '@/lib/hooks/useCodeMapper';
import { BoundaryData } from '@/lib/hooks/useBoundaryData';
import { MapOptions } from '@/lib/types/mapOptions';

interface UIOverlayProps {
	datasets: Datasets;
	activeDataset: Dataset | null;
	aggregatedData: any;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	selectedLocation: string;
	selectedWardData: LocalElectionWardData | null;
	selectedConstituencyData: ConstituencyData | null;
	boundaryData: BoundaryData;
	codeMapper: CodeMapper;
	mapOptions: any;
	onMapOptionsChange: (type: keyof MapOptions, options: Partial<MapOptions[typeof type]>) => void;
	onLocationClick: (location: string) => void;
}

export default function UIOverlay({
	datasets,
	activeDataset,
	activeViz,
	setActiveViz,
	aggregatedData,
	selectedLocation,
	selectedWardData,
	selectedConstituencyData,
	boundaryData,
	codeMapper,
	mapOptions,
	onMapOptionsChange,
	onLocationClick,
}: UIOverlayProps) {
	return (
		<div className="fixed inset-0 z-50 h-full w-full pointer-events-none">
			<div className="absolute left-0 flex h-full">
				<ControlPanel
					population={datasets['population']['population-2022']}
					selectedLocation={selectedLocation}
					onLocationClick={onLocationClick}
				/>
			</div>

			<div className="absolute right-0 flex h-full">
				<LegendPanel
					activeDataset={activeDataset}
					aggregatedData={aggregatedData}
					mapOptions={mapOptions}
					onMapOptionsChange={onMapOptionsChange}
				/>
				<ChartPanel
					datasets={datasets}
					activeViz={activeViz}
					setActiveViz={setActiveViz}
					activeDataset={activeDataset}
					aggregatedData={aggregatedData}
					selectedLocation={selectedLocation}
					selectedWard={selectedWardData}
					selectedConstituency={selectedConstituencyData}
					boundaryData={boundaryData}
					codeMapper={codeMapper}
				/>
			</div>
		</div>
	);
}