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

    // Update callbacks ref without triggering re-initialization
    useEffect(() => {
        console.log('Update map manager callback ref')
        callbacksRef.current = opts;
    });

    useEffect(() => {
        console.log('Update map manager options')
        if (!opts.mapRef?.current || !opts.geojson) return;

        managerRef.current = new MapManager(opts.mapRef.current, {
            onWardHover: (params) => {
                // Use the ref to get the latest callback
                if (callbacksRef.current.onWardHover) {
                    callbacksRef.current.onWardHover(params);
                }
            },
            onLocationChange: (stats, location) => {
                // Use the ref to get the latest callback
                if (callbacksRef.current.onLocationChange) {
                    callbacksRef.current.onLocationChange(stats, location);
                }
            }
        });

        return () => {
            managerRef.current = null;
        };
    }, [opts.mapRef, opts.geojson]); // Only re-run when map or geojson changes

    return managerRef;
}