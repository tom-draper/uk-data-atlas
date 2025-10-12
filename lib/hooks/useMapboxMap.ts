// lib/hooks/useMapboxMap.ts
import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

export const useMapboxMap = (containerRef: React.RefObject<HTMLDivElement>) => {
    const map = useRef<mapboxgl.Map | null>(null);

    useEffect(() => {
        if (map.current) return;

        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        if (!token) return;

        mapboxgl.accessToken = token;

        if (containerRef.current) {
            map.current = new mapboxgl.Map({
                container: containerRef.current,
                style: 'mapbox://styles/mapbox/light-v11',
                center: [-2.3, 53.5],
                zoom: 10,
            });

            map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
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