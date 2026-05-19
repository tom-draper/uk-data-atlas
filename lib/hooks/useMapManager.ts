import { useEffect, useRef, useState } from "react";
import { MapManager } from "@/lib/helpers/mapManager";
import { SelectedArea } from "../types";

type UseMapManagerOptions = {
	mapRef: React.RefObject<maplibregl.Map | null>;
	mapReady: boolean;
	interactionHandlers: {
		onAreaHover: (area: SelectedArea | null) => void;
		onLocationChange: (location: string) => void;
	};
};

export function useMapManager({
	mapRef,
	mapReady,
	interactionHandlers,
}: UseMapManagerOptions) {
	const [mapManager, setMapManager] = useState<MapManager | null>(null);
	const handlersRef = useRef(interactionHandlers);
	handlersRef.current = interactionHandlers;

	useEffect(() => {
		if (!mapReady || !mapRef?.current) return;

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
	}, [mapReady, mapRef]);

	return mapManager;
}
