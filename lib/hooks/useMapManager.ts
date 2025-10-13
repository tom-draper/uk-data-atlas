import { useEffect, useRef } from 'react';
import type mapboxgl from 'mapbox-gl';
import { MapManager } from '@/lib/utils/mapManager';
import type { ChartData, LocationBounds } from '@/lib/types';

type UseMapManagerOptions = {
    mapRef: React.RefObject<mapboxgl.Map | null>;
    geojson: any | null;
    onWardHover?: (info: { data: any; wardName: string; wardCode: string } | null) => void;
    onLocationChange?: (stats: ChartData | null, location: LocationBounds) => void;
};

export function useMapManager(opts: UseMapManagerOptions) {
    const managerRef = useRef<MapManager | null>(null);

    useEffect(() => {
        if (!opts.mapRef?.current || !opts.geojson) return;

        managerRef.current = new MapManager(opts.mapRef.current, {
            onWardHover: (data, wardName, wardCode) => {
                if (opts.onWardHover) opts.onWardHover(data ? { data, wardName, wardCode } : null);
            },
            onLocationChange: (stats, location) => {
                if (opts.onLocationChange) opts.onLocationChange(stats, location);
            }
        });

        return () => {
            // MapManager might have its own teardown, but we null our ref to allow GC
            managerRef.current = null;
        };
    }, [opts.mapRef, opts.geojson]);

    // expose the ref so callers can call methods
    return managerRef;
}