// page.tsx
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useElectionData } from '@/lib/hooks/useElectionData';
import { LocationPanel } from '@/components/LocationPanel';
import { LegendPanel } from '@/components/LegendPanel';
import { ChartPanel } from '@/components/ChartPanel';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { MapManager } from '@/lib/utils/mapManager';
import { calculateLocationStats, mapWard2023ToGeojson } from '@/lib/utils/statsCalculator';
import { LOCATIONS } from '@/lib/data/locations';
import { ChartData, LocationBounds } from '@/lib/types';
import mapboxgl from 'mapbox-gl';

export default function MapsPage() {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const { datasets, loading: dataLoading, error: dataError } = useElectionData();

    const [error, setError] = useState<string>(dataError || '');
    const [loading, setLoading] = useState(true);
    const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
    const [allGeoJSON, setAllGeoJSON] = useState<any>(null);
    const [chartData, setChartData] = useState<ChartData>({ LAB: 0, CON: 0, LD: 0, GREEN: 0, REF: 0, IND: 0 });
    const [chartTitle, setChartTitle] = useState<string>('Greater Manchester');
    const [chartWardCode, setChartWardCode] = useState<string>('');
    const [activeDatasetId, setActiveDatasetId] = useState<string>('2024');
    const mapManagerRef = useRef<MapManager | null>(null);

    const activeDataset = datasets.find(d => d.id === activeDatasetId) || datasets[0];

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
        console.log('Page useEffect triggered:', { mapLoaded: !!map.current, datasetsLength: datasets.length, activeDatasetId });

        if (!map.current || datasets.length === 0) {
            console.log('Skipping - map or datasets missing', { mapLoaded: !!map.current, datasetsLength: datasets.length });
            return;
        }

        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        if (!token) {
            setError('Missing NEXT_PUBLIC_MAPBOX_TOKEN environment variable.');
            setLoading(false);
            return;
        }

        const onMapLoad = () => {
            console.log('onMapLoad called');
            // Load the correct GeoJSON based on active dataset
            const url = activeDataset.id === '2023'
                ? '/data/wards/Wards_December_2023_Boundaries_UK_BGC_-915726682161155301.geojson'
                : '/data/wards/Wards_December_2024_Boundaries_UK_BGC_-2654605954884295357.geojson';

            console.log('Loading GeoJSON:', url);

            fetch(url)
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.json();
                })
                .then(data => {
                    console.log('GeoJSON loaded, features:', data.features?.length);
                    setAllGeoJSON(data);

                    // For 2023, match ward names to ward codes in the GeoJSON
                    let activeWardResults = activeDataset.wardResults;
                    let activeWardData = activeDataset.wardData;

                    if (activeDataset.id === '2023') {
                        console.log('Mapping 2023 data...');
                        const { wardResults: mapped2023Results, wardData: mapped2023Data } =
                            mapWard2023ToGeojson(activeDataset, data);
                        activeWardResults = mapped2023Results;
                        activeWardData = mapped2023Data;
                    }

                    mapManagerRef.current = new MapManager(map.current!, {
                        onWardHover: (data, wardName, wardCode) => {
                            if (data) {
                                setChartData({
                                    LAB: (data.LAB as number) || 0,
                                    CON: (data.CON as number) || 0,
                                    LD: (data.LD as number) || 0,
                                    GREEN: (data.GREEN as number) || 0,
                                    REF: (data.REF as number) || 0,
                                    IND: (data.IND as number) || 0
                                });
                                setChartTitle(wardName);
                                setChartWardCode(wardCode);
                            }
                        },
                        onLocationChange: (stats, location) => {
                            setChartData(stats);
                            setChartTitle(location.name);
                            setChartWardCode('');
                        }
                    });

                    const initialLocation = LOCATIONS[0];
                    const locationStats = calculateLocationStats(initialLocation, data, activeWardData);
                    mapManagerRef.current.updateMapForLocation(
                        initialLocation,
                        data,
                        activeWardResults,
                        activeWardData,
                        locationStats,
                        activeDataset.partyInfo
                    );

                    setSelectedLocation(initialLocation.name);
                    console.log('Map setup complete');
                    setLoading(false);
                })
                .catch(err => {
                    console.error('Error loading/processing data:', err);
                    setError(`Failed to load ward data: ${err.message}`);
                    setLoading(false);
                });
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
    }, [map, datasets.length, activeDatasetId]);

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
        setChartData({ LAB: 0, CON: 0, LD: 0, GREEN: 0, REF: 0, IND: 0 });
        setChartTitle('Greater Manchester');
        setChartWardCode('');

        // Reset and reload map with new dataset
        if (allGeoJSON && mapManagerRef.current && map.current) {
            const newDataset = datasets.find(d => d.id === datasetId);
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
                        chartData={chartData}
                        activeDataset={activeDataset}
                        availableDatasets={datasets}
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