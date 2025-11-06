import { useEffect, useRef, useState } from 'react';
import { MapManager } from '@lib/utils/mapManager';
import type { ChartData, LocalElectionWardData } from '@lib/types';

type UseMapManagerOptions = {
    mapRef: React.RefObject<mapboxgl.Map | null>;
    geojson: any | null;
    onWardHover?: (params: { data: LocalElectionWardData | null; wardCode: string }) => void;
    onConstituencyHover?: (data: any | null) => void;
    onLocationChange?: (stats: ChartData | null, location: string) => void;
};

export function useMapManager(opts: UseMapManagerOptions) {
    const [mapManager, setMapManager] = useState<MapManager | null>(null);
    const callbacksRef = useRef(opts);
    const isInitialized = useRef(false);

    // Update callbacks ref without triggering re-initialization
    useEffect(() => {
        callbacksRef.current = opts;
    });

    // Initialize manager once when both map and geojson are ready
    useEffect(() => {
        if (!opts.mapRef?.current || !opts.geojson || isInitialized.current) return;
        
        const manager = new MapManager(opts.mapRef.current, {
            onWardHover: (params) => {
                if (callbacksRef.current.onWardHover) {
                    callbacksRef.current.onWardHover(params);
                }
            },
            onConstituencyHover: (data) => {
                if (callbacksRef.current.onConstituencyHover) {
                    callbacksRef.current.onConstituencyHover(data);
                }
            },
            onLocationChange: (stats, location) => {
                if (callbacksRef.current.onLocationChange) {
                    callbacksRef.current.onLocationChange(stats, location);
                }
            }
        });
        
        setMapManager(manager);
        isInitialized.current = true;

        return () => {
            // Only cleanup if the map itself is being destroyed
            if (!opts.mapRef?.current) {
                setMapManager(null);
                isInitialized.current = false;
            }
        };
    }, [opts.mapRef, opts.geojson]);

    return { mapManager };
}