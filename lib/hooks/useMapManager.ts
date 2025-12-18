import { useEffect, useState } from 'react';
import { MapManager } from '@/lib/helpers/mapManager';
import { BoundaryGeojson, SelectedArea } from '../types';

type UseMapManagerOptions = {
    mapRef: React.RefObject<mapboxgl.Map | maplibregl.Map | null>;
    geojson: BoundaryGeojson | null;
    interactionHandlers: {
        onAreaHover: (area: SelectedArea | null) => void;
        onLocationChange: (location: string) => void;
    }
};

export function useMapManager({mapRef, geojson, interactionHandlers}: UseMapManagerOptions) {
    const [mapManager, setMapManager] = useState<MapManager | null>(null);

    useEffect(() => {
        if (!mapRef?.current || !geojson) return;

        if (mapManager) return;

        const manager = new MapManager(mapRef.current, {
            onAreaHover: (data) => interactionHandlers.onAreaHover(data),
            onLocationChange: (location) => interactionHandlers.onLocationChange(location)
        });

        setMapManager(manager);

        return () => {
            manager.destroy();
            setMapManager(null);
        };
    }, [mapRef, !!geojson]);

    return mapManager;
}