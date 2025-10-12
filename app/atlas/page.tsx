// page.tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useElectionData } from '@/lib/hooks/useElectionData';
import { useMapboxMap } from '@/lib/hooks/useMapboxMap';
import { LocationPanel } from '@/components/LocationPanel';
import { LegendPanel } from '@/components/LegendPanel';
import { ChartPanel } from '@/components/ChartPanel';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { MapManager } from '@/lib/utils/mapManager';
import { calculateLocationStats } from '@/lib/utils/statsCalculator';
import { LOCATIONS } from '@/lib/data/locations';
import { ChartData, WardData, LocationBounds } from '@/lib/types';

export default function MapsPage() {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useMapboxMap(mapContainer);
    const { wardResults, wardData, loading: dataLoading, error: dataError } = useElectionData();

    const [error, setError] = useState<string>(dataError || '');
    const [loading, setLoading] = useState(true);
    const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
    const [allGeoJSON, setAllGeoJSON] = useState<any>(null);
    const [chartData, setChartData] = useState<ChartData>({ LAB: 0, CON: 0, LD: 0, GREEN: 0, REF: 0, IND: 0 });
    const [chartTitle, setChartTitle] = useState<string>('Greater Manchester');
    const [chartWardCode, setChartWardCode] = useState<string>('');
    const mapManagerRef = useRef<MapManager | null>(null);

    useEffect(() => {
        if (error) setError(error);
    }, [dataError]);

    useEffect(() => {
        if (!map.current || Object.keys(wardResults).length === 0) return;

        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        if (!token) {
            setError('Missing NEXT_PUBLIC_MAPBOX_TOKEN environment variable.');
            setLoading(false);
            return;
        }

        const onMapLoad = () => {
            fetch('/data/wards/Wards_December_2024_Boundaries_UK_BGC_-2654605954884295357.geojson')
                .then(res => res.json())
                .then(data => {
                    setAllGeoJSON(data);

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
                    const locationStats = calculateLocationStats(initialLocation, data, wardData);
                    mapManagerRef.current.updateMapForLocation(
                        initialLocation,
                        data,
                        wardResults,
                        wardData,
                        locationStats
                    );

                    setSelectedLocation(initialLocation.name);
                    setLoading(false);
                })
                .catch(err => {
                    setError(`Failed to load ward data: ${err.message}`);
                    setLoading(false);
                });
        };

        if (map.current.loaded()) {
            onMapLoad();
        } else {
            map.current.on('load', onMapLoad);
        }

        return () => {
            if (map.current) {
                map.current.off('load', onMapLoad);
            }
        };
    }, [map, wardResults, wardData]);

    const handleLocationClick = (location: LocationBounds) => {
        setSelectedLocation(location.name);
        if (allGeoJSON && mapManagerRef.current && map.current) {
            const locationStats = calculateLocationStats(location, allGeoJSON, wardData);
            mapManagerRef.current.updateMapForLocation(
                location,
                allGeoJSON,
                wardResults,
                wardData,
                locationStats
            );
            map.current.fitBounds(location.bounds, {
                padding: 40,
                duration: 1000
            });
        }
    };

    if (error) {
        return <ErrorDisplay message={error} />;
    }

    return (
        <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
            {loading || dataLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                    <div className="text-lg">Loading map...</div>
                </div>
            )}
            <div className="fixed inset-0 z-100 h-full w-full pointer-events-none">
                <div className="absolute left-0 flex h-full">
                    <LocationPanel selectedLocation={selectedLocation} onLocationClick={handleLocationClick} />
                </div>

                <div className="absolute right-0 flex h-full">
                    <LegendPanel />
                    <ChartPanel title={chartTitle} wardCode={chartWardCode} chartData={chartData} />
                </div>
            </div>
            <div
                ref={mapContainer}
                style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
            />
        </div>
    );
}