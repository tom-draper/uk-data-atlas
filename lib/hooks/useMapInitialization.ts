import { MAP_TYPE } from '../config/map';
import { useMapboxInitialization } from './useMapboxInitialization';
import { useMapLibreInitialization } from './useMapLibreInitialization';

interface UseMapInitializationOptions {
    style: string;
    center: [number, number];
    zoom: number;
    maxBounds: [number, number, number, number];
}

export function useMapInitialization(options: UseMapInitializationOptions) {
    switch (MAP_TYPE) {
        case 'maplibre':
            return useMapLibreInitialization(options);
        case 'mapbox':
            return useMapboxInitialization(options);
    }

    return useMapLibreInitialization(options);
}