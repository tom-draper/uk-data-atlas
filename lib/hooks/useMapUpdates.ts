import { useEffect } from 'react';
import { ActiveViz, Dataset } from '@lib/types';
import type { MapManager } from '../utils/mapManager';
import { MapOptions } from '../types/mapOptions';

interface UseMapUpdatesParams {
    geojson: any;
    activeViz: ActiveViz;
    activeDataset: Dataset | null;
    mapManager: MapManager | null;
    mapOptions: MapOptions;
}

export function useMapUpdates({
    geojson,
    activeViz,
    activeDataset,
    mapManager,
    mapOptions,
}: UseMapUpdatesParams) {
    useEffect(() => {
        if (!geojson || !activeDataset || !mapManager) return;

        const performUpdate = () => {
            switch (activeDataset.type) {
                case 'general-election':
                    return mapManager.updateMapForGeneralElection(geojson, activeDataset, mapOptions);
                
                case 'local-election':
                    return mapManager.updateMapForLocalElection(geojson, activeDataset, mapOptions);
                
                case 'house-price':
                    return mapManager.updateMapForHousePrices(geojson, activeDataset, mapOptions);

                case 'population':
                    // Handle population sub-categories
                    if (activeViz.vizId.startsWith('age-distribution')) {
                        return mapManager.updateMapForAgeDistribution(geojson, activeDataset, mapOptions);
                    }
                    if (activeViz.vizId.startsWith('population-density')) {
                        return mapManager.updateMapForPopulationDensity(geojson, activeDataset, mapOptions);
                    }
                    if (activeViz.vizId.startsWith('gender')) {
                        return mapManager.updateMapForGender(geojson, activeDataset, mapOptions);
                    }
                    break;

                default:
                    console.warn(`No map update strategy found for dataset type: ${activeDataset.type}`);
            }
        };

        performUpdate();
    }, [geojson, activeDataset, activeViz, mapManager, mapOptions]);
}