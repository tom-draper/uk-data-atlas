// page.tsx
'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useElectionData } from '@/lib/hooks/useElectionData';
import { usePopulationData } from '@/lib/hooks/usePopulationData';
import { LocationPanel } from '@/components/LocationPanel';
import { LegendPanel } from '@/components/LegendPanel';
import { ChartPanel } from '@/components/ChartPanel';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { MapManager } from '@/lib/utils/mapManager';
import { calculateLocationStats, mapWard2023ToGeojson } from '@/lib/utils/statsCalculator';
import { LOCATIONS } from '@/lib/data/locations';
import { ChartData, Dataset, LocationBounds } from '@/lib/types';

export default function MapsPage() {
	const mapContainer = useRef<HTMLDivElement>(null);
	const map = useRef<mapboxgl.Map | null>(null);
	const { datasets, loading: dataLoading, error: dataError } = useElectionData();
	const { populationData, loading: popLoading, error: popError } = usePopulationData();

	const [error, setError] = useState<string>(dataError || '');
	const [loading, setLoading] = useState(true);
	const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
	const [allGeoJSON, setAllGeoJSON] = useState<any>(null);
	const [chartData2024, setChartData2024] = useState<ChartData>({ LAB: 0, CON: 0, LD: 0, GREEN: 0, REF: 0, IND: 0 });
	const [chartData2023, setChartData2023] = useState<ChartData>({ LAB: 0, CON: 0, LD: 0, GREEN: 0, REF: 0, IND: 0 });
	const [chartData2022, setChartData2022] = useState<ChartData>({ LAB: 0, CON: 0, LD: 0, GREEN: 0, REF: 0, IND: 0 });
	const [chartData2021, setChartData2021] = useState<ChartData>({ LAB: 0, CON: 0, LD: 0, GREEN: 0, REF: 0, IND: 0 });
	const [chartTitle, setChartTitle] = useState<string>('Greater Manchester');
	const [chartWardCode, setChartWardCode] = useState<string>('');
	const [activeDatasetId, setActiveDatasetId] = useState<string>('2024');
	const [genderFilter, setGenderFilter] = useState<'total' | 'males' | 'females'>('total');
	const mapManagerRef = useRef<MapManager | null>(null);

	const allDatasets = useMemo(() => {
		const populationDatasetsArray: Dataset[] = [
			{
				id: 'pop-persons',
				name: 'Population (Total) 2020',
				year: 2020,
				type: 'population',
				populationData: populationData,
				partyInfo: [
					{ key: 'TOTAL', name: 'Total Population', color: '#3b82f6' }
				],
			},
		];

		return [...datasets, ...populationDatasetsArray];
	}, [datasets, populationData]);

	// Store ward data for all years
	const wardDataRef = useRef<{
		data2024: any;
		data2023: any;
		data2022: any;
		data2021: any;
		results2024: any;
		results2023: any;
		results2022: any;
		results2021: any;
	}>({
		data2024: null,
		data2023: null,
		data2022: null,
		data2021: null,
		results2024: null,
		results2023: null,
		results2022: null,
		results2021: null,
	});

	const activeDataset = allDatasets.find(d => d.id === activeDatasetId) || allDatasets[0];

	useEffect(() => {
		if (dataError) setError(dataError);
	}, [dataError]);

	const handleMapContainer = useCallback((el: HTMLDivElement | null) => {
		mapContainer.current = el;

		if (!el) return;
		if (map.current) return;

		const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
		if (!token) {
			console.error('Missing NEXT_PUBLIC_MAPBOX_TOKEN');
			setError('Missing NEXT_PUBLIC_MAPBOX_TOKEN');
			return;
		}

		console.log('Initializing Mapbox from callback ref');
		mapboxgl.accessToken = token;

		try {
			map.current = new mapboxgl.Map({
				container: el,
				style: 'mapbox://styles/mapbox/light-v11',
				center: [-2.3, 53.5],
				zoom: 10,
			});
			map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
			console.log('Map initialized');
		} catch (err) {
			console.error('Failed to initialize map:', err);
			setError(`Failed to initialize map: ${err}`);
		}
	}, []);

	useEffect(() => {
		console.log('Page useEffect triggered:', { mapLoaded: !!map.current, datasetsLength: allDatasets.length, activeDatasetId });

		if (!map.current || allDatasets.length === 0) {
			console.log('Skipping - map or datasets missing', { mapLoaded: !!map.current, datasetsLength: allDatasets.length });
			return;
		}

		const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
		if (!token) {
			setError('Missing NEXT_PUBLIC_MAPBOX_TOKEN environment variable.');
			setLoading(false);
			return;
		}

		const onMapLoad = async () => {
			console.log('onMapLoad called');

			try {
				// Fetch all GeoJSON files
				const [geojson2024, geojson2023, geojson2022, geojson2021] = await Promise.all([
					fetch('/data/wards/Wards_December_2024_Boundaries_UK_BGC_-2654605954884295357.geojson').then(r => r.json()),
					fetch('/data/wards/Wards_December_2023_Boundaries_UK_BGC_-915726682161155301.geojson').then(r => r.json()),
					fetch('/data/wards/Wards_December_2022_Boundaries_UK_BGC_-898530251172766412.geojson').then(r => r.json()),
					fetch('/data/wards/Wards_December_2021_UK_BGC_2022_-3127229614810050524.geojson').then(r => r.json()),
				]);

				console.log('All GeoJSON files loaded');

				// Use active dataset's GeoJSON for map display
				const activeGeoJSON = activeDatasetId === '2023' ? geojson2023
					: activeDatasetId === '2022' ? geojson2022
						: activeDatasetId === '2021' ? geojson2021
							: geojson2024;

				setAllGeoJSON(activeGeoJSON);

				// Prepare data for all datasets
				const dataset2024 = allDatasets.find(d => d.id === '2024');
				const dataset2023 = allDatasets.find(d => d.id === '2023');
				const dataset2022 = allDatasets.find(d => d.id === '2022');
				const dataset2021 = allDatasets.find(d => d.id === '2021');

				let results2024 = dataset2024?.wardResults || {};
				let data2024 = dataset2024?.wardData || {};
				let results2023 = dataset2023?.wardResults || {};
				let data2023 = dataset2023?.wardData || {};
				let results2022 = dataset2022?.wardResults || {};
				let data2022 = dataset2022?.wardData || {};
				let results2021 = dataset2021?.wardResults || {};
				let data2021 = dataset2021?.wardData || {};

				// Map 2023, 2022, 2021 data if needed
				if (dataset2023) {
					const { wardResults: mapped2023Results, wardData: mapped2023Data } =
						mapWard2023ToGeojson(dataset2023, geojson2023);
					results2023 = mapped2023Results;
					data2023 = mapped2023Data;
				}

				// Store all in ref for lookup during hover
				wardDataRef.current = {
					data2024,
					data2023,
					data2022,
					data2021,
					results2024,
					results2023,
					results2022,
					results2021,
				};

				// Use active dataset for initial map rendering
				let activeWardResults = results2024;
				let activeWardData = data2024;

				if (activeDatasetId === '2023') {
					activeWardResults = results2023;
					activeWardData = data2023;
				} else if (activeDatasetId === '2022') {
					activeWardResults = results2022;
					activeWardData = data2022;
				} else if (activeDatasetId === '2021') {
					activeWardResults = results2021;
					activeWardData = data2021;
				}

				mapManagerRef.current = new MapManager(map.current!, {
					onWardHover: (data, wardName, wardCode) => {
						if (data) {
							// Look up data from ALL datasets
							const data2024Obj: ChartData = {
								LAB: (wardDataRef.current.data2024[wardCode]?.LAB as number) || 0,
								CON: (wardDataRef.current.data2024[wardCode]?.CON as number) || 0,
								LD: (wardDataRef.current.data2024[wardCode]?.LD as number) || 0,
								GREEN: (wardDataRef.current.data2024[wardCode]?.GREEN as number) || 0,
								REF: (wardDataRef.current.data2024[wardCode]?.REF as number) || 0,
								IND: (wardDataRef.current.data2024[wardCode]?.IND as number) || 0
							};

							const data2023Obj: ChartData = {
								LAB: (wardDataRef.current.data2023[wardCode]?.LAB as number) || 0,
								CON: (wardDataRef.current.data2023[wardCode]?.CON as number) || 0,
								LD: (wardDataRef.current.data2023[wardCode]?.LD as number) || 0,
								GREEN: (wardDataRef.current.data2023[wardCode]?.GREEN as number) || 0,
								REF: (wardDataRef.current.data2023[wardCode]?.REF as number) || 0,
								IND: (wardDataRef.current.data2023[wardCode]?.IND as number) || 0
							};

							const data2022Obj: ChartData = {
								LAB: (wardDataRef.current.data2022[wardCode]?.LAB as number) || 0,
								CON: (wardDataRef.current.data2022[wardCode]?.CON as number) || 0,
								LD: (wardDataRef.current.data2022[wardCode]?.LD as number) || 0,
								GREEN: (wardDataRef.current.data2022[wardCode]?.GREEN as number) || 0,
								REF: (wardDataRef.current.data2022[wardCode]?.REF as number) || 0,
								IND: (wardDataRef.current.data2022[wardCode]?.IND as number) || 0
							};

							const data2021Obj: ChartData = {
								LAB: (wardDataRef.current.data2021[wardCode]?.LAB as number) || 0,
								CON: (wardDataRef.current.data2021[wardCode]?.CON as number) || 0,
								LD: (wardDataRef.current.data2021[wardCode]?.LD as number) || 0,
								GREEN: (wardDataRef.current.data2021[wardCode]?.GREEN as number) || 0,
								REF: (wardDataRef.current.data2021[wardCode]?.REF as number) || 0,
								IND: (wardDataRef.current.data2021[wardCode]?.IND as number) || 0
							};

							// Update all chart datasets
							setChartData2024(data2024Obj);
							setChartData2023(data2023Obj);
							setChartData2022(data2022Obj);
							setChartData2021(data2021Obj);

							setChartTitle(wardName);
							setChartWardCode(wardCode);
						}
					},
					onLocationChange: (stats, location) => {
						// Set stats for all datasets
						setChartData2024(stats);
						setChartData2023(stats);
						setChartData2022(stats);
						setChartData2021(stats);

						setChartTitle(location.name);
						setChartWardCode('');
					}
				});

				const initialLocation = LOCATIONS[0];
				const locationStats = calculateLocationStats(initialLocation, activeGeoJSON, activeWardData);
				mapManagerRef.current.updateMapForLocation(
					initialLocation,
					activeGeoJSON,
					activeWardResults,
					activeWardData,
					locationStats,
					activeDataset.partyInfo
				);

				setSelectedLocation(initialLocation.name);
				console.log('Map setup complete');
				setLoading(false);
			} catch (err) {
				console.error('Error loading/processing data:', err);
				setError(`Failed to load ward data: ${err instanceof Error ? err.message : 'Unknown error'}`);
				setLoading(false);
			}
		};

		const handleLoad = () => {
			console.log('Map load event fired');
			onMapLoad();
		};

		if (map.current.loaded()) {
			console.log('Map already loaded, calling onMapLoad');
			onMapLoad();
		} else {
			console.log('Waiting for map load event');
			map.current.on('load', handleLoad);
		}

		return () => {
			if (map.current) {
				map.current.off('load', handleLoad);
			}
		};
	}, [map, allDatasets.length, activeDatasetId]);

	const handleLocationClick = (location: LocationBounds) => {
		setSelectedLocation(location.name);
		if (allGeoJSON && mapManagerRef.current && map.current && activeDataset) {
			let wardResults = activeDataset.wardResults;
			let wardData = activeDataset.wardData;

			if (activeDataset.id === '2023') {
				const { wardResults: mapped, wardData: mappedData } =
					mapWard2023ToGeojson(activeDataset, allGeoJSON);
				wardResults = mapped;
				wardData = mappedData;
			}

			const locationStats = calculateLocationStats(location, allGeoJSON, wardData);
			mapManagerRef.current.updateMapForLocation(
				location,
				allGeoJSON,
				wardResults,
				wardData,
				locationStats,
				activeDataset.partyInfo
			);
			map.current.fitBounds(location.bounds, {
				padding: 40,
				duration: 1000
			});
		}
	};

	const handleDatasetChange = (datasetId: string) => {
		setActiveDatasetId(datasetId);
		setChartTitle('Greater Manchester');
		setChartWardCode('');

		// Reset and reload map with new dataset
		if (mapManagerRef.current && map.current) {
			const newDataset = allDatasets.find(d => d.id === datasetId);
			if (!newDataset) return;

			let wardResults = newDataset.wardResults;
			let wardData = newDataset.wardData;

			if (datasetId === '2023') {
				const { wardResults: mapped, wardData: mappedData } =
					mapWard2023ToGeojson(newDataset, allGeoJSON);
				wardResults = mapped;
				wardData = mappedData;
			}

			const initialLocation = LOCATIONS[0];
			const locationStats = calculateLocationStats(initialLocation, allGeoJSON, wardData);
			mapManagerRef.current.updateMapForLocation(
				initialLocation,
				allGeoJSON,
				wardResults,
				wardData,
				locationStats,
				newDataset.partyInfo
			);
		}
	};

	if (error) {
		return <ErrorDisplay message={error} />;
	}

	if (!activeDataset) {
		return <ErrorDisplay message="No datasets loaded" />;
	}

	return (
		<div style={{ width: '100%', height: '100vh', position: 'relative' }}>
			{(loading || dataLoading) && (
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
						wardCode={chartWardCode}
						population={populationData}
						chartData2024={chartData2024}
						chartData2023={chartData2023}
						chartData2022={chartData2022}
						chartData2021={chartData2021}
						activeDataset={activeDataset}
						availableDatasets={allDatasets}
						onDatasetChange={handleDatasetChange}
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