import { useEffect, useRef, useState } from "react";
import { MapManager } from "@/lib/helpers/mapManager";
import { BoundaryGeojson, SelectedArea } from "../types";

type UseMapManagerOptions = {
	mapRef: React.RefObject<maplibregl.Map | null>;
	geojson: BoundaryGeojson | null;
	interactionHandlers: {
		onAreaHover: (area: SelectedArea | null) => void;
		onLocationChange: (location: string) => void;
	};
};

export function useMapManager({
	mapRef,
	geojson,
	interactionHandlers,
}: UseMapManagerOptions) {
	const [mapManager, setMapManager] = useState<MapManager | null>(null);
	const handlersRef = useRef(interactionHandlers);
	handlersRef.current = interactionHandlers;

	useEffect(() => {
		if (!mapRef?.current || !geojson) return;

		if (mapManager) return;

		const manager = new MapManager(mapRef.current, {
			onAreaHover: (data) => handlersRef.current.onAreaHover(data),
			onLocationChange: (location) =>
				handlersRef.current.onLocationChange(location),
		});

		setMapManager(manager);

		return () => {
			manager.destroy();
			setMapManager(null);
		};
	}, [mapRef, !!geojson]);

	return mapManager;
}
