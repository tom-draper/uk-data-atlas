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
	const [aggregatedChartData, setAggregatedChartData] = useState<ChartData | null>(null);
	const [chartTitle, setChartTitle] = useState<string>('Greater Manchester');
	const [chartWardName, setChartWardName] = useState<string>('');
	const [chartWardCode, setChartWardCode] = useState<string>('');
	const [wardNameToPopCodeMap, setWardNameToPopCodeMap] = useState<{ [name: string]: string }>({});
	const [activeDatasetId, setActiveDatasetId] = useState<string>('2024');
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

		mapboxgl.accessToken = token;

		try {
			map.current = new mapboxgl.Map({
				container: el,
				style: 'mapbox://styles/mapbox/light-v11',
				center: [-2.3, 53.5],
				zoom: 10,
			});
			map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
		} catch (err) {
			console.error('Failed to initialize map:', err);
			setError(`Failed to initialize map: ${err}`);
		}
	}, []);

	useEffect(() => {
		if (!map.current || allDatasets.length === 0) {
			return;
		}

		const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
		if (!token) {
			setError('Missing NEXT_PUBLIC_MAPBOX_TOKEN environment variable.');
			setLoading(false);
			return;
		}

		const onMapLoad = async () => {
			try {
				// Fetch all GeoJSON files
				const [geojson2024, geojson2023, geojson2022, geojson2021] = await Promise.all([
					fetch('/data/wards/Wards_December_2024_Boundaries_UK_BGC_-2654605954884295357.geojson').then(r => r.json()),
					fetch('/data/wards/Wards_December_2023_Boundaries_UK_BGC_-915726682161155301.geojson').then(r => r.json()),
					fetch('/data/wards/Wards_December_2022_Boundaries_UK_BGC_-898530251172766412.geojson').then(r => r.json()),
					fetch('/data/wards/Wards_December_2021_UK_BGC_2022_-3127229614810050524.geojson').then(r => r.json()),
				]);

				// Use active dataset's GeoJSON for map display
				const activeGeoJSON = activeDatasetId === '2023' ? geojson2023
					: activeDatasetId === '2022' ? geojson2022
						: activeDatasetId === '2021' ? geojson2021
							: geojson2024;
				console.log(`Using ${activeDatasetId} geojson ward boundaries`)

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

				// Create and store the ward name to code mapping in state
				const wardNameToPopCode: { [name: string]: string } = {};
				for (const wardCode of Object.keys(populationData)) {
					const feature = activeGeoJSON.features.find((f: any) =>
						f.properties.WD23CD === wardCode || f.properties.WD24CD === wardCode ||
						f.properties.WD22CD === wardCode || f.properties.WD21CD === wardCode
					);
					if (feature) {
						const name = (feature.properties.WD23NM || '').toLowerCase().trim();
						if (name) wardNameToPopCode[name] = wardCode;
					}
				}
				setWardNameToPopCodeMap(wardNameToPopCode);

				mapManagerRef.current = new MapManager(map.current!, {
					// onWardHover: (data, wardName, wardCode) => {
					// 	if (data) {
					// 		setChartTitle(wardName);
					// 		setChartWardCode(wardCode); // Use the mapped population ward code
					// 		setChartWardName(wardName); // Use the mapped population ward code
					// 		setAggregatedChartData(null); // Clear aggregated data on ward hover
					// 	} else {
					// 		console.log('No data for ward hover');
					// 	}
					// },
					onWardHover: (data, wardName, wardCode) => {
						if (data) {
							setChartTitle(wardName);
							setChartWardCode(wardCode);
							setChartWardName(wardName);
							setAggregatedChartData(null); // Clear aggregated data on ward hover
						} else {
							// Restore the current location's aggregated data when leaving a ward
							if (selectedLocation) {
								const currentLocation = LOCATIONS.find(loc => loc.name === selectedLocation);
								if (currentLocation && allGeoJSON && wardDataRef.current) {
									// Determine which ward data to use based on active dataset
									let wardData = wardDataRef.current.data2024;
									if (activeDatasetId === '2023') {
										wardData = wardDataRef.current.data2023;
									} else if (activeDatasetId === '2022') {
										wardData = wardDataRef.current.data2022;
									} else if (activeDatasetId === '2021') {
										wardData = wardDataRef.current.data2021;
									}

									const locationStats = calculateLocationStats(currentLocation, allGeoJSON, wardData);
									setAggregatedChartData(locationStats);
									setChartTitle(currentLocation.name);
									setChartWardCode('');
									setChartWardName('');
								}
							}
						}
					},
					onLocationChange: (stats, location) => {
						console.log('📍 Location change:', location.name);
						setAggregatedChartData(stats);
						setChartTitle(location.name);
						setChartWardCode('');
						setChartWardName('');
					}
				});

				const initialLocation = LOCATIONS[0];
				const locationStats = calculateLocationStats(initialLocation, activeGeoJSON, activeWardData);

				setAggregatedChartData(locationStats);

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
			onMapLoad();
		};

		if (map.current.loaded()) {
			onMapLoad();
		} else {
			map.current.on('load', handleLoad);
		}

		return () => {
			if (map.current) {
				map.current.off('load', handleLoad);
			}
		};
	}, [map, allDatasets.length, activeDatasetId, populationData]);

	const handleLocationClick = (location: LocationBounds) => {
		setSelectedLocation(location.name);
		if (allGeoJSON && mapManagerRef.current && map.current && activeDataset) {
			let wardResults = activeDataset.wardResults;
			let wardData = activeDataset.wardData;

			// 2023 data did not come with any ward codes, so find equivalent
			if (activeDataset.id === '2023') {
				const { wardResults: mapped, wardData: mappedData } =
					mapWard2023ToGeojson(activeDataset, allGeoJSON);
				wardResults = mapped;
				wardData = mappedData;
			}

			const locationStats = calculateLocationStats(location, allGeoJSON, wardData);

			setAggregatedChartData(locationStats);

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

		const initialLocation = LOCATIONS[0];
		setChartTitle(initialLocation.name);
		setChartWardCode('');

		// Reset and reload map with new dataset
		if (mapManagerRef.current && map.current & allGeoJSON) {
			const newDataset = allDatasets.find(d => d.id === datasetId);
			if (!newDataset) return;

			let wardResults = newDataset.wardResults;
			let wardData = newDataset.wardData;

			// 2023 data did not come with any ward codes, so find equivalent
			if (datasetId === '2023') {
				const { wardResults: mapped, wardData: mappedData } =
					mapWard2023ToGeojson(newDataset, allGeoJSON);
				wardResults = mapped;
				wardData = mappedData;
			}

			const initialLocation = LOCATIONS[0];
			const locationStats = calculateLocationStats(initialLocation, allGeoJSON, wardData);

			setAggregatedChartData(locationStats);

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
						activeDataset={activeDataset}
						availableDatasets={allDatasets}
						onDatasetChange={handleDatasetChange}
						wardData={wardDataRef.current}
						aggregatedData={aggregatedChartData}
						wardName={chartWardName}
						wardCodeMap={wardNameToPopCodeMap}
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