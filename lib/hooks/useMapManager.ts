import { useEffect, useRef } from 'react';
import { MapManager } from '@/lib/utils/mapManager';
import type { ChartData, LocationBounds, WardData } from '@/lib/types';

type UseMapManagerOptions = {
    mapRef: React.RefObject<mapboxgl.Map | null>;
    geojson: any | null;
    onWardHover?: (params: { data: WardData | null; wardCode: string }) => void;
    onLocationChange?: (stats: ChartData | null, location: LocationBounds) => void;
};

export function useMapManager(opts: UseMapManagerOptions) {
    const managerRef = useRef<MapManager | null>(null);
    const callbacksRef = useRef(opts);
    const hasInitialized = useRef(false);

    // Update callbacks ref without triggering re-initialization
    useEffect(() => {
        callbacksRef.current = opts;
    });

    // Initialize manager once when both map and geojson are ready
    useEffect(() => {
        if (!opts.mapRef?.current || !opts.geojson) return;
        if (hasInitialized.current) {
            console.log('Skipping map manager re-init - already initialized');
            return;
        }
        
        console.log('Initializing map manager...')
        managerRef.current = new MapManager(opts.mapRef.current, {
            onWardHover: (params) => {
                console.log('managerRef onWardHover', params)
                if (callbacksRef.current.onWardHover) {
                    callbacksRef.current.onWardHover(params);
                }
            },
            onLocationChange: (stats, location) => {
                if (callbacksRef.current.onLocationChange) {
                    callbacksRef.current.onLocationChange(stats, location);
                }
            }
        });
        
        hasInitialized.current = true;

        return () => {
            // Only cleanup if the map itself is being destroyed
            if (!opts.mapRef?.current) {
                managerRef.current = null;
                hasInitialized.current = false;
            }
        };
    }, [opts.mapRef, opts.geojson]);

    return managerRef;
}