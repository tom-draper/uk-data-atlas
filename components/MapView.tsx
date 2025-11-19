import { type MapManager } from '@/lib/utils/mapManager';
import { useMapUpdates } from '@lib/hooks/useMapUpdates';
import { Dataset } from '@/lib/types';

interface MapViewProps {
	activeDataset: Dataset | null;
	geojson: any;
	mapManager: MapManager | null;
	mapOptions: any;
	handleMapContainer: (node: HTMLDivElement | null) => void;
}

export default function MapView({
	activeDataset,
	geojson,
	mapManager,
	mapOptions,
	handleMapContainer,
}: MapViewProps) {
	// Handle all map updates through custom hook
	useMapUpdates({
		geojson,
		activeDataset,
		mapManager,
		mapOptions,
	});

	return (
		<div
			ref={handleMapContainer}
			style={{ 
				width: '100%', 
				height: '100%', 
				position: 'absolute', 
				top: 0, 
				left: 0 
			}}
		/>
	);
}