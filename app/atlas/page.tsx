'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useElectionData } from '@/lib/hooks/useElectionData';
import { usePopulationData } from '@/lib/hooks/usePopulationData';
import { LocationPanel } from '@/components/LocationPanel';
import { LegendPanel } from '@/components/LegendPanel';
import { ChartPanel } from '@/components/ChartPanel';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { useMapboxMap } from '@/lib/hooks/useMapboxMap';
import { useWardDatasets } from '@/lib/hooks/useWardDatasets';
import { useMapManager } from '@/lib/hooks/useMapManager';
import { LOCATIONS } from '@/lib/data/locations';
import type { ChartData, Dataset, LocationBounds } from '@/lib/types';
import mapboxgl from 'mapbox-gl';

export default function MapsPage() {
	const mapContainer = useRef<HTMLDivElement | null>(null);
	const map = useRef<mapboxgl.Map | null>(null);

	const { datasets: electionDatasets, loading: dataLoading, error: dataError } = useElectionData();
	const { datasets: populationDatasets, loading: popLoading, error: popError } = usePopulationData();

	const [activeDatasetId, setActiveDatasetId] = useState<string>('2024');
	const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
	const [aggregatedChartData, setAggregatedChartData] = useState<ChartData | null>(null);
	const [chartTitle, setChartTitle] = useState<string>('Greater Manchester');

	const allDatasets: Dataset[] = useMemo(() => [...electionDatasets, ...populationDatasets], [electionDatasets, populationDatasets]);
	const activeDataset = allDatasets.find(d => d.id === activeDatasetId) || allDatasets[0];

	const { geojson: activeGeoJSON, wardData, wardResults, wardNameToPopCode } = useWardDatasets(allDatasets, activeDatasetId, populationDatasets);

	const handleMapContainer = useCallback((el: HTMLDivElement | null) => {
		mapContainer.current = el;
		if (!el) return;
		if (map.current) return;
		const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
		if (!token) {
			console.error('Missing NEXT_PUBLIC_MAPBOX_TOKEN');
			// setError('Missing NEXT_PUBLIC_MAPBOX_TOKEN'); 
			return;
		} mapboxgl.accessToken = token;
		try {
			map.current = new mapboxgl.Map({ container: el, style: 'mapbox://styles/mapbox/light-v11', center: [-2.3, 53.5], zoom: 10, });
			map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
		} catch (err) {
			console.error('Failed to initialize map:', err);
			// setError(`Failed to initialize map: ${err}`); 
		}
	}, []);

	const mapManagerRef = useMapManager({
		mapRef, geojson: activeGeoJSON, onWardHover: (info) => {
			if (!info) return;
			setChartTitle(info.wardName || '');
			setAggregatedChartData(null);
		}, onLocationChange: (stats, location) => {
			setChartTitle(location.name);
			setAggregatedChartData(stats);
		}
	});

	// initial selection effect: when datasets and geojson ready set initial location
	useEffect(() => {
		if (!activeGeoJSON || !wardData || !mapManagerRef.current || !activeDataset) return;
		const initialLocation = LOCATIONS[0];
		const stats = mapManagerRef.current.calculateAndCacheLocation(initialLocation, activeGeoJSON, wardData);
		setAggregatedChartData(stats);
		mapManagerRef.current.updateMapForLocation(initialLocation, activeGeoJSON, wardResults, wardData, stats, activeDataset.partyInfo);
		setSelectedLocation(initialLocation.name);
		setChartTitle(initialLocation.name);
	}, [activeGeoJSON, wardData, wardResults, activeDataset, mapManagerRef]);

	const handleLocationClick = (location: LocationBounds) => {
		setSelectedLocation(location.name);
		if (!mapManagerRef.current || !activeGeoJSON || !activeDataset) return;

		let results = activeDataset.wardResults;
		let data = activeDataset.wardData;
		if (activeDataset.id === '2023') {
			// use mapped values returned earlier by useWardDatasets
			results = wardResults || results;
			data = wardData || data;
		}

		const stats = mapManagerRef.current.calculateAndCacheLocation(location, activeGeoJSON, data);
		setAggregatedChartData(stats);

		mapManagerRef.current.updateMapForLocation(location, activeGeoJSON, results, data, stats, activeDataset.partyInfo);
		if (mapRef.current) {
			mapRef.current.fitBounds(location.bounds, { padding: 40, duration: 1000 });
		}
	};

	const handleDatasetChange = (id: string) => {
		setActiveDatasetId(id);
		// ChartPanel will trigger dataset change; the hooks react to activeDatasetId and update map accordingly
	}

	if (dataError || popError) {
		return <ErrorDisplay message={(dataError || popError) ?? 'Error loading data'} />;
	}

	if (!activeDataset) {
		return <ErrorDisplay message="No datasets loaded" />;
	}

	return (
		<div style={{ width: '100%', height: '100vh', position: 'relative' }}>
			{(dataLoading || popLoading) && (
				<div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
					<div className="text-lg">Loading map...</div>
				</div>
			)}

			<div className="fixed inset-0 z-100 h-full w-full pointer-events-none">
				<div className="absolute left-0 flex h-full">
					<LocationPanel selectedLocation={selectedLocation} onLocationClick={handleLocationClick} />
				</div>

				<div className="absolute right-0 flex h-full">
					<LegendPanel activeDataset={activeDataset} />
					<ChartPanel
						title={chartTitle}
						wardCode={''}
						population={populationDatasets[0]?.populationData}
						activeDataset={activeDataset}
						availableDatasets={allDatasets}
						onDatasetChange={handleDatasetChange}
						wardData={{}}
						aggregatedData={aggregatedChartData}
						wardName={''}
						localAuthorityName={''}
						localAuthorityCode={''}
						wardCodeMap={wardNameToPopCode}
					/>
				</div>
			</div>

			<div ref={handleMapContainer} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />
		</div>
	);
}