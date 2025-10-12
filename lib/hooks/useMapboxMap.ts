// lib/hooks/useMapboxMap.ts
import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

export const useMapboxMap = (containerRef: React.RefObject<HTMLDivElement>) => {
    const map = useRef<mapboxgl.Map | null>(null);

    useEffect(() => {
        // Skip if map already exists
        if (map.current) return;

        // Skip if no container
        if (!containerRef.current) return;

        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        if (!token) {
            console.error('Missing NEXT_PUBLIC_MAPBOX_TOKEN');
            return;
        }

        console.log('Initializing Mapbox');
        mapboxgl.accessToken = token;

        try {
            map.current = new mapboxgl.Map({
                container: containerRef.current,
                style: 'mapbox://styles/mapbox/light-v11',
                center: [-2.3, 53.5],
                zoom: 10,
            });

            map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
            console.log('Map initialized');

        } catch (err) {
            console.error('Failed to initialize map:', err);
        }

        return () => {
            if (map.current) {
                map.current.remove();
                map.current = null;
            }
        };
    }, [containerRef]);

    return map;
};