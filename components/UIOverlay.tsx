import ControlPanel from "@components/ControlPanel";
import LegendPanel from "@components/LegendPanel";
import ChartPanel from "@components/ChartPanel";
import type {
	ActiveViz,
	AggregatedData,
	BoundaryCodes,
	BoundaryData,
	Dataset,
	Datasets,
	SelectedArea,
} from "@lib/types";
import { MapOptions } from "@/lib/types/mapOptions";
import { CodeType } from "@/lib/hooks/useCodeMapper";

interface UIOverlayProps {
	datasets: Datasets;
	activeDataset: Dataset | null;
	aggregatedData: AggregatedData;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	selectedLocation: string;
	selectedArea: SelectedArea | null;
	boundaryData: BoundaryData;
	boundaryCodes: BoundaryCodes;
	mapOptions: MapOptions;
	codeMapper?: {
		getCodeForYear: (
			type: CodeType,
			code: string,
			targetYear: number,
		) => string | undefined;
		getWardsForLad: (ladCode: string, year: number) => string[];
	};
	onMapOptionsChange: (
		type: keyof MapOptions,
		options: Partial<MapOptions[typeof type]>,
	) => void;
	onLocationClick: (location: string) => void;
	onZoomIn: () => void;
	onZoomOut: () => void;
	handleMapOptionsChange: (
		type: keyof MapOptions,
		options: Partial<MapOptions[typeof type]>,
	) => void;
	onExport: () => void;
}

export default function UIOverlay({
	datasets,
	activeDataset,
	activeViz,
	setActiveViz,
	aggregatedData,
	selectedLocation,
	selectedArea,
	boundaryData,
	boundaryCodes,
	mapOptions,
	codeMapper,
	onMapOptionsChange,
	onLocationClick,
	onZoomIn,
	onZoomOut,
	handleMapOptionsChange,
	onExport,
}: UIOverlayProps) {
	return (
		<div className="fixed inset-0 z-50 h-full w-full pointer-events-none">
			<div className="absolute left-0 flex h-full">
				<ControlPanel
					populationDataset={datasets["population"][2022]}
					selectedLocation={selectedLocation}
					onLocationClick={onLocationClick}
					onZoomIn={onZoomIn}
					onZoomOut={onZoomOut}
					handleMapOptionsChange={handleMapOptionsChange}
					onExport={onExport}
				/>
			</div>

			<div className="absolute right-0 flex h-full">
				<LegendPanel
					activeDataset={activeDataset}
					activeViz={activeViz}
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
					selectedArea={selectedArea}
					boundaryData={boundaryData}
					boundaryCodes={boundaryCodes}
					codeMapper={codeMapper}
				/>
			</div>
		</div>
	);
}
