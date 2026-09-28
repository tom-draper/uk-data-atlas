"use client";

import { useMapSession } from "@/lib/hooks/useMapSession";
import MapView from "@components/MapView";
import UIOverlay from "@components/UIOverlay";
import type { ActiveViz, Datasets } from "@lib/types";
import type { CustomDataset } from "@/lib/types/custom";
import type { NetworkDataset } from "@/lib/types/network";
import { MapOptionsProvider } from "@/lib/context/MapOptionsContext";
import { ThemeProvider } from "@/lib/context/ThemeContext";

interface MapInterfaceProps {
	datasets: Datasets;
	datasetsLoading: boolean;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	selectedLocation: string;
	setSelectedLocation: (location: string) => void;
	customDatasets: CustomDataset[];
	addCustomDataset: (dataset: CustomDataset) => void;
	roadSafetyDatasets: CustomDataset[];
	networkDatasets: NetworkDataset[];
	onError?: (error: Error) => void;
}

export default function MapInterface({
	datasets,
	datasetsLoading,
	activeViz,
	setActiveViz,
	selectedLocation,
	setSelectedLocation,
	customDatasets,
	addCustomDataset,
	roadSafetyDatasets,
	networkDatasets,
	onError,
}: MapInterfaceProps) {
	const session = useMapSession({
		datasets,
		datasetsLoading,
		activeViz,
		selectedLocation,
		setSelectedLocation,
		customDatasets,
		roadSafetyDatasets,
		networkDatasets,
		onError,
	});

	return (
		<MapOptionsProvider value={session.mapOptions}>
			<ThemeProvider
				value={session.mapOptions.baseStyle.id === "darkMatter"}
			>
				<div className="relative w-full h-screen">
					{!session.mapOptions.visibility.hideOverlay && (
						<UIOverlay
							selectedLocation={selectedLocation}
							selectedArea={session.selectedArea}
							boundaryData={session.boundaryData}
							mapOptions={session.mapOptions}
							codeMapper={session.codeMapper}
							onMapOptionsChange={session.handleMapOptionsChange}
							onLocationClick={session.onLocationClick}
							onZoomIn={session.onZoomIn}
							onZoomOut={session.onZoomOut}
							activeDataset={session.activeDataset}
							activeViz={activeViz}
							setActiveViz={setActiveViz}
							mapManager={session.mapManager}
							chartsLoading={session.chartsLoading}
							datasets={session.normalizedDatasets}
							customDatasets={customDatasets}
							addCustomDataset={addCustomDataset}
							roadSafetyDatasets={roadSafetyDatasets}
							networkDatasets={networkDatasets}
							onExport={session.onExport}
						/>
					)}
					<MapView
						activeDataset={session.activeDataset}
						activeViz={activeViz}
						geojson={session.geojson}
						mapManager={session.mapManager}
						mapOptions={session.mapOptions}
						handleMapContainer={session.handleMapContainer}
						styleReady={session.styleReady}
						selectedLocation={selectedLocation}
					/>
				</div>
			</ThemeProvider>
		</MapOptionsProvider>
	);
}
