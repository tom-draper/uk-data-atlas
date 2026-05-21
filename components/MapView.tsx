import { memo } from "react";
import { type MapManager } from "@/lib/helpers/mapManager";
import { useMapUpdates } from "@lib/hooks/useMapUpdates";
import { ActiveViz, BoundaryGeojson, Dataset } from "@/lib/types";
import { MapOptions } from "@/lib/types/mapOptions";

interface MapViewProps {
	activeDataset: Dataset | null;
	activeViz: ActiveViz;
	geojson: BoundaryGeojson | null;
	mapManager: MapManager | null;
	mapOptions: MapOptions;
	handleMapContainer: (node: HTMLDivElement | null) => void;
	styleVersion: number;
}

export default memo(function MapView({
	activeDataset,
	activeViz,
	geojson,
	mapManager,
	mapOptions,
	handleMapContainer,
	styleVersion,
}: MapViewProps) {
	useMapUpdates({
		geojson,
		activeViz,
		activeDataset,
		mapManager,
		mapOptions,
		styleVersion,
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
});
