import { useEffect, useState } from 'react';
import { MapManager } from '@lib/utils/mapManager';
import type { LocationHoverData } from '@lib/utils/mapManager/mapManager';
import { BoundaryGeojson } from '../types';

type UseMapManagerOptions = {
    mapRef: React.RefObject<mapboxgl.Map | maplibregl.Map | null>;
    geojson: BoundaryGeojson | null;
    onLocationHover: (location: LocationHoverData | null) => void;
    onLocationChange: (location: string) => void;
};

export function useMapManager(opts: UseMapManagerOptions) {
    const [mapManager, setMapManager] = useState<MapManager | null>(null);

    useEffect(() => {
        if (!opts.mapRef?.current || !opts.geojson) return;

        if (mapManager) return;

        const manager = new MapManager(opts.mapRef.current, {
            onLocationHover: (data) => opts.onLocationHover(data),
            onLocationChange: (location) => opts.onLocationChange(location)
        });

        setMapManager(manager);

        return () => {
            manager.destroy();
            setMapManager(null);
        };
    }, [opts.mapRef, !!opts.geojson]);

    return mapManager;
}