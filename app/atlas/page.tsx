// page.tsx
'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

import { useElectionData } from '@/lib/hooks/useElectionData';
import { usePopulationData } from '@/lib/hooks/usePopulationData';
import { useWardDatasets } from '@/lib/hooks/useWardDatasets';
import { useMapManager } from '@/lib/hooks/useMapManager';

import ControlPanel from '@/components/ControlPanel';
import LegendPanel from '@/components/LegendPanel';
import ChartPanel from '@/components/ChartPanel';
import ErrorDisplay from '@/components/ErrorDisplay';

import { LOCATIONS } from '@/lib/data/locations';
import type { ChartData, LocationBounds, WardData } from '@/lib/types';

interface AggregatedChartData {
	data2024: ChartData | null;
	data2023: ChartData | null;
	data2022: ChartData | null;
	data2021: ChartData | null;
}

const YEARS = ['2024', '2023', '2022', '2021'] as const;
const INITIAL_LOCATION = LOCATIONS[0];
const MAP_CONFIG = {
	style: 'mapbox://styles/mapbox/light-v11',
	center: [-2.3, 53.5] as [number, number],
	zoom: 10,
	fitBoundsPadding: 40,
	fitBoundsDuration: 1000,
};

export default function MapsPage() {
	// Refs
	const mapContainer = useRef<HTMLDivElement | null>(null);
	const map = useRef<mapboxgl.Map | null>(null);
	const hasInitialized = useRef(false);

	// Data hooks
	const { datasets: electionDatasets, loading: dataLoading, error: dataError } = useElectionData();
	const { datasets: populationDatasets, loading: popLoading, error: popError } = usePopulationData();

	// State
	const [activeDatasetId, setActiveDatasetId] = useState<string>('2024');
	const [selectedWard, setSelectedWard] = useState<WardData | null>(null);
	const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
	const [chartTitle, setChartTitle] = useState<string>('Greater Manchester');
	const [aggregatedChartData, setAggregatedChartData] = useState<AggregatedChartData>({
		data2024: null,
		data2023: null,
		data2022: null,
		data2021: null,
	});

	// Computed values
	const allDatasets = useMemo(
		() => [...electionDatasets, ...populationDatasets],
		[electionDatasets, populationDatasets]
	);

	const activeDataset = useMemo(
		() => allDatasets.find(d => d.id === activeDatasetId) || allDatasets[0],
		[allDatasets, activeDatasetId]
	);

	const { geojson: activeGeoJSON, wardData, wardResults, wardNameToPopCode, isLoading: wardDataLoading } =
		useWardDatasets(allDatasets, activeDatasetId, populationDatasets);

	const allYearsWardData = useMemo(() => ({
		data2024: electionDatasets.find(d => d.id === '2024')?.wardData || {},
		data2023: electionDatasets.find(d => d.id === '2023')?.wardData || {},
		data2022: electionDatasets.find(d => d.id === '2022')?.wardData || {},
		data2021: electionDatasets.find(d => d.id === '2021')?.wardData || {},
	}), [electionDatasets]);

	// Map initialization
	const handleMapContainer = useCallback((el: HTMLDivElement | null) => {
		mapContainer.current = el;
		if (!el || map.current) return;

		const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
		if (!token) {
			console.error('Missing NEXT_PUBLIC_MAPBOX_TOKEN');
			return;
		}

		mapboxgl.accessToken = token;

		try {
			map.current = new mapboxgl.Map({
				container: el,
				style: MAP_CONFIG.style,
				center: MAP_CONFIG.center,
				zoom: MAP_CONFIG.zoom,
			});
			map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
		} catch (err) {
			console.error('Failed to initialize map:', err);
		}
	}, []);

	// Map manager setup
	const mapManagerRef = useMapManager({
		mapRef: map,
		geojson: activeGeoJSON,
		onWardHover: (params) => {
			const { data, wardCode } = params;

			if (!data) {
				setChartTitle(selectedLocation || '');
				setSelectedWard(null);
				return;
			}

			setChartTitle(data.wardName || '');
			setSelectedWard({ ...data, wardCode });
		},
		onLocationChange: (stats, location) => {
			console.log('OnLocationChange');
			setChartTitle(location.name);
			setSelectedWard(null);
		},
	});

	// Helper function to calculate all years data
	const calculateAllYearsData = useCallback((location: LocationBounds): AggregatedChartData => {
		if (!mapManagerRef.current || !activeGeoJSON) {
			return { data2024: null, data2023: null, data2022: null, data2021: null };
		}

		const result: any = {};
		for (const year of YEARS) {
			const dataset = electionDatasets.find(d => d.id === year);
			result[`data${year}`] = dataset?.wardData
				? mapManagerRef.current.calculateLocationStats(location, activeGeoJSON, dataset.wardData)
				: null;
		}

		return result as AggregatedChartData;
	}, [mapManagerRef, activeGeoJSON, electionDatasets]);

	// Initial location setup (runs once on data load)
	useEffect(() => {
		if (!activeGeoJSON || !wardData || !mapManagerRef.current || !activeDataset) return;
		if (hasInitialized.current) return;

		hasInitialized.current = true;

		const currentStats = mapManagerRef.current.calculateLocationStats(
			INITIAL_LOCATION,
			activeGeoJSON,
			wardData
		);

		const allYearAggregates = calculateAllYearsData(INITIAL_LOCATION);
		console.log('Setting aggregate', allYearAggregates);
		setAggregatedChartData(allYearAggregates);

		mapManagerRef.current.updateMapForLocation(
			INITIAL_LOCATION,
			activeGeoJSON,
			wardResults,
			wardData,
			currentStats,
			activeDataset.partyInfo
		);

		setSelectedLocation(INITIAL_LOCATION.name);
		setChartTitle(INITIAL_LOCATION.name);
		setSelectedWard(null);
	}, [activeGeoJSON, wardData, wardResults, activeDataset, mapManagerRef, calculateAllYearsData]);

	// Update map when dataset changes
	useEffect(() => {
		if (!activeGeoJSON || !wardData || !mapManagerRef.current || !activeDataset || !selectedLocation) return;

		const currentLocation = LOCATIONS.find(loc => loc.name === selectedLocation);
		if (!currentLocation) return;

		const stats = mapManagerRef.current.calculateLocationStats(
			currentLocation,
			activeGeoJSON,
			wardData
		);

		mapManagerRef.current.updateMapForLocation(
			currentLocation,
			activeGeoJSON,
			wardResults,
			wardData,
			stats,
			activeDataset.partyInfo
		);
	}, [activeDatasetId, activeGeoJSON, wardData, wardResults, activeDataset, selectedLocation, mapManagerRef]);

	// Handlers
	const handleLocationClick = useCallback((location: LocationBounds) => {
		setSelectedLocation(location.name);
		if (!mapManagerRef.current || !activeGeoJSON || !activeDataset) return;

		const stats = mapManagerRef.current.calculateLocationStats(
			location,
			activeGeoJSON,
			activeDataset.wardData
		);

		const newAggregates = calculateAllYearsData(location);
		console.log('Setting aggregate', newAggregates);
		setAggregatedChartData(newAggregates);

		mapManagerRef.current.updateMapForLocation(
			location,
			activeGeoJSON,
			activeDataset.wardResults,
			activeDataset.wardData,
			stats,
			activeDataset.partyInfo
		);

		map.current?.fitBounds(location.bounds, {
			padding: MAP_CONFIG.fitBoundsPadding,
			duration: MAP_CONFIG.fitBoundsDuration,
		});
	}, [mapManagerRef, activeGeoJSON, activeDataset, calculateAllYearsData]);

	const handleDatasetChange = useCallback((id: string) => {
		setActiveDatasetId(id);
	}, []);

	const isLoading = dataLoading || popLoading;

	if (isLoading) {
		return (
			<div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
				<div className="text-sm">Loading map...</div>
			</div>
		);
	}

	// Error states
	if (dataError || popError) {
		return <ErrorDisplay message={(dataError || popError) ?? 'Error loading data'} />;
	}

	if (!activeDataset) {
		return <ErrorDisplay message="No datasets loaded" />;
	}

	return (
		<div style={{ width: '100%', height: '100vh', position: 'relative' }}>
			<div className="fixed inset-0 z-[50] h-full w-full pointer-events-none">
				<div className="absolute left-0 flex h-full">
					<ControlPanel
						selectedLocation={selectedLocation}
						onLocationClick={handleLocationClick}
						population={populationDatasets[0]?.populationData ?? {}}
					/>
				</div>

				<div className="absolute right-0 flex h-full">
					<LegendPanel />
					<ChartPanel
						title={chartTitle}
						selectedWard={selectedWard}
						wardData={allYearsWardData}
						population={populationDatasets[0]?.populationData ?? {}}
						activeDataset={activeDataset}
						availableDatasets={allDatasets}
						onDatasetChange={handleDatasetChange}
						aggregatedData={aggregatedChartData}
						wardCodeMap={wardNameToPopCode}
					/>
				</div>
			</div>

			<div
				ref={handleMapContainer}
				style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
			/>
		</div>
	);
}