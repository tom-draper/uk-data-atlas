
import { type MapManager } from "@/lib/helpers/mapManager";
import { useMapUpdates } from "@lib/hooks/useMapUpdates";
import { ActiveViz, BoundaryData, BoundaryGeojson, Dataset } from "@/lib/types";
import { MapOptions } from "@/lib/types/mapOptions";

interface MapViewProps {
	activeDataset: Dataset | null;
	activeViz: ActiveViz;
	geojson: BoundaryGeojson | null;
	mapManager: MapManager | null;
	mapOptions: MapOptions;
	handleMapContainer: (node: HTMLDivElement | null) => void;
	styleReady: boolean;
	selectedLocation: string;
	boundaryData: BoundaryData;
}

export default function MapView({
	activeDataset,
	activeViz,
	geojson,
	mapManager,
	mapOptions,
	handleMapContainer,
	styleReady,
	selectedLocation,
	boundaryData,
}: MapViewProps) {
	useMapUpdates({
		geojson,
		activeViz,
		activeDataset,
		mapManager,
		mapOptions,
		styleReady,
		selectedLocation,
		boundaryData,
	});

	return (
		<div
			ref={handleMapContainer}
			style={{
				width: "100%",
				height: "100%",
				position: "absolute",
				top: 0,
				left: 0,
			}}
		/>
	);
}
