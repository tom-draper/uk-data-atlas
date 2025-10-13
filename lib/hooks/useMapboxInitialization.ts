import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';


export function useMapboxInitialization(containerRef: React.RefObject<HTMLDivElement>) {
    const mapRef = useRef<mapboxgl.Map | null>(null);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        if (mapRef.current) return;


        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        if (!token) {
            console.error('Missing NEXT_PUBLIC_MAPBOX_TOKEN');
            return;
        }

        mapboxgl.accessToken = token;

        try {
            const map = new mapboxgl.Map({
                container: el,
                style: 'mapbox://styles/mapbox/light-v11',
                center: [-2.3, 53.5],
                zoom: 10,
            });
            map.addControl(new mapboxgl.NavigationControl(), 'top-right');
            mapRef.current = map;
        } catch (err) {
            console.error('Failed to initialize map', err);
        }


        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [containerRef]);

    return mapRef;
}