import { type MapManager } from '@/lib/utils/mapManager';
import { useData } from '@lib/contexts/dataContext';
import { useMapUpdates } from '@lib/hooks/useMapUpdates';

interface MapViewProps {
	mapRef: any;
	geojson: any;
	mapManager: MapManager | null;
	mapOptions: any;
	handleMapContainer: (node: HTMLDivElement | null) => void;
}

export default function MapView({
	mapRef,
	geojson,
	mapManager,
	mapOptions,
	handleMapContainer,
}: MapViewProps) {
	const { activeDatasetId, activeDataset } = useData();

	// Handle all map updates through custom hook
	useMapUpdates({
		geojson,
		activeDataset,
		activeDatasetId,
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