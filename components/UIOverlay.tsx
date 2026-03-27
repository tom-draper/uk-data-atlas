import { memo, useDeferredValue, useMemo } from "react";
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
import type { CustomDataset } from "@/lib/types/custom";
import { MapOptions } from "@/lib/types/mapOptions";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import { PanelContext } from "@/lib/context/PanelContext";

interface UIOverlayProps {
	datasets: Datasets;
	customDataset: CustomDataset | null;
	setCustomDataset: (dataset: CustomDataset | null) => void;
	activeDataset: Dataset | null;
	aggregatedData: AggregatedData;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	selectedLocation: string;
	selectedArea: SelectedArea | null;
	boundaryData: BoundaryData;
	boundaryCodes: BoundaryCodes;
	mapOptions: MapOptions;
	codeMapper?: CodeMapper;
	onMapOptionsChange: (
		type: keyof MapOptions,
		options: Partial<MapOptions[typeof type]>,
	) => void;
	onLocationClick: (location: string) => void;
	onZoomIn: () => void;
	onZoomOut: () => void;
	onExport: () => void;
}

export default memo(function UIOverlay({
	datasets,
	customDataset,
	setCustomDataset,
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
	onExport,
}: UIOverlayProps) {
	// Defer selectedArea to ChartPanel — PanelHeader reads immediate value via context
	// so ChartPanel's memo bails during rapid hover (only UIOverlay + PanelHeader re-render)
	const deferredSelectedArea = useDeferredValue(selectedArea);

	// Stable context value — only recreated when immediate selectedArea/selectedLocation changes
	const panelContextValue = useMemo(
		() => ({ selectedArea, selectedLocation }),
		[selectedArea, selectedLocation],
	);

	return (
		<PanelContext.Provider value={panelContextValue}>
			<div className="fixed inset-0 z-50 h-full w-full pointer-events-none">
				<div className="absolute left-0 flex h-full">
					<ControlPanel
						populationDataset={datasets["population"][2022]}
						selectedLocation={selectedLocation}
						onLocationClick={onLocationClick}
						onZoomIn={onZoomIn}
						onZoomOut={onZoomOut}
						handleMapOptionsChange={onMapOptionsChange}
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
						customDataset={customDataset}
						setCustomDataset={setCustomDataset}
						activeViz={activeViz}
						setActiveViz={setActiveViz}
						activeDataset={activeDataset}
						aggregatedData={aggregatedData}
						selectedArea={deferredSelectedArea}
						boundaryData={boundaryData}
						boundaryCodes={boundaryCodes}
						codeMapper={codeMapper}
					/>
				</div>
			</div>
		</PanelContext.Provider>
	);
});
