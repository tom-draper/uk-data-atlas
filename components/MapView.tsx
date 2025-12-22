import { type MapManager } from "@/lib/helpers/mapManager";
import { useMapUpdates } from "@lib/hooks/useMapUpdates";
import { ActiveViz, Dataset } from "@/lib/types";

interface MapViewProps {
	activeDataset: Dataset | null;
	activeViz: ActiveViz;
	geojson: any;
	mapManager: MapManager | null;
	mapOptions: any;
	handleMapContainer: (node: HTMLDivElement | null) => void;
}

export default function MapView({
	activeDataset,
	activeViz,
	geojson,
	mapManager,
	mapOptions,
	handleMapContainer,
}: MapViewProps) {
	useMapUpdates({
		geojson,
		activeViz,
		activeDataset,
		mapManager,
		mapOptions,
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
