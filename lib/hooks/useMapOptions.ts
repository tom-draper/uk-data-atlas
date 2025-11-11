import { useCallback, useState } from 'react';
import { MapOptions } from '../types/mapOptions';

export function useMapOptions(options: MapOptions) {
	const [mapOptions, setMapOptions] = useState<MapOptions>(options);

	const handleMapOptionsChange = useCallback((type: keyof MapOptions, options: Partial<MapOptions[typeof type]>) => {
		setMapOptions(prev => ({
			...prev,
			[type]: {
				...prev[type],
				...options,
			},
		}));
	}, []);

    return { mapOptions, setMapOptions: handleMapOptionsChange };
}