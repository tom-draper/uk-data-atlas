import { useCallback, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

interface UseMapInitializationOptions {
	style: string;
	center: [number, number];
	zoom: number;
}

export function useMapInitialization({ style, center, zoom }: UseMapInitializationOptions) {
	const mapRef = useRef<mapboxgl.Map | null>(null);

	const handleMapContainer = useCallback((el: HTMLDivElement | null) => {
		if (!el || mapRef.current) return;

		const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
		if (!token) {
			console.error('Missing NEXT_PUBLIC_MAPBOX_TOKEN');
			return;
		}

		mapboxgl.accessToken = token;

		try {
			mapRef.current = new mapboxgl.Map({
				container: el,
				style,
				center,
				zoom,
			});
		} catch (err) {
			console.error('Failed to initialize map:', err);
		}
	}, [style, center, zoom]);

	useEffect(() => {
		return () => {
			if (mapRef.current) {
				mapRef.current.remove();
				mapRef.current = null;
			}
		};
	}, []);

	return { mapRef, handleMapContainer };
}