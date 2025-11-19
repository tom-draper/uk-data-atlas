import { useEffect } from 'react';
import type { MapManager, Dataset } from '@lib/types';

interface UseMapUpdatesParams {
	geojson: any;
	activeDataset: Dataset | null;
	activeDatasetId: string;
	mapManager: MapManager | null;
	mapOptions: any;
}

export function useMapUpdates({
	geojson,
	activeDataset,
	activeDatasetId,
	mapManager,
	mapOptions,
}: UseMapUpdatesParams) {
	useEffect(() => {
		if (!geojson || !activeDataset || !mapManager) return;

		const updateStrategies = {
			'population': () => {
				const handlers = {
					'age-distribution': () => 
						mapManager.updateMapForAgeDistribution(
							geojson, 
							activeDataset, 
							mapOptions['age-distribution']
						),
					'population-density': () => 
						mapManager.updateMapForPopulationDensity(
							geojson, 
							activeDataset, 
							mapOptions['population-density']
						),
					'gender': () => 
						mapManager.updateMapForGender(
							geojson, 
							activeDataset, 
							mapOptions['gender']
						),
				};
				
				const handlerKey = Object.keys(handlers).find(
					key => activeDatasetId.startsWith(key)
				);
				
				if (handlerKey) {
					handlers[handlerKey as keyof typeof handlers]();
				}
			},
			'general-election': () => 
				mapManager.updateMapForGeneralElection(
					geojson, 
					activeDataset, 
					mapOptions[activeDataset.type]
				),
			'local-election': () => 
				mapManager.updateMapForLocalElection(
					geojson, 
					activeDataset, 
					mapOptions[activeDataset.type]
				),
			'house-price': () => 
				mapManager.updateMapForHousePrices(
					geojson, 
					activeDataset, 
					mapOptions[activeDataset.type]
				),
		};

		const updateStrategy = updateStrategies[activeDataset.type as keyof typeof updateStrategies];
		updateStrategy?.();
	}, [geojson, activeDataset, activeDatasetId, mapManager, mapOptions]);
}