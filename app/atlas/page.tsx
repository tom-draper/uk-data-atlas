'use client';
import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import Papa from 'papaparse';

interface WardData {
    [key: string]: string | number;
}

interface LocationBounds {
    name: string;
    lad_codes: string[];
    bounds: [number, number, number, number];
}

interface ChartData {
    LAB: number;
    CON: number;
    LD: number;
    GREEN: number;
    REF: number;
    IND: number;
}

export default function MapsPage() {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [wardResults, setWardResults] = useState<Record<string, string>>({});
    const [wardData, setWardData] = useState<Record<string, WardData>>({});
    const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
    const [allGeoJSON, setAllGeoJSON] = useState<any>(null);
    const [chartData, setChartData] = useState<ChartData>({ LAB: 0, CON: 0, LD: 0, GREEN: 0, REF: 0, IND: 0 });
    const [chartTitle, setChartTitle] = useState<string>('Greater Manchester');
    const [chartWardCode, setChartWardCode] = useState<string>('');
    const currentWardRef = useRef<string | null>(null);
    const lastHoveredFeatureRef = useRef<any>(null);

    const locations: LocationBounds[] = [
        {
            name: 'Greater Manchester',
            lad_codes: ['E08000001', 'E08000002', 'E08000003', 'E08000004', 'E08000005', 'E08000006', 'E08000007', 'E08000008', 'E08000009', 'E08000010'],
            bounds: [-2.5, 53.3, -2.0, 53.7]
        },
        {
            name: 'Merseyside',
            lad_codes: ['E08000012', 'E08000013', 'E08000014', 'E08000015'],
            bounds: [-3.0, 53.35, -2.7, 53.55]
        },
        {
            name: 'Warrington',
            lad_codes: ['E06000007'],
            bounds: [-2.6, 53.35, -2.5, 53.45]
        },
        {
            name: 'Chester',
            lad_codes: ['E06000050'],
            bounds: [-2.9, 53.15, -2.7, 53.25]
        },
        {
            name: 'Birmingham',
            lad_codes: ['E08000025', 'E08000026', 'E08000027', 'E08000028', 'E08000029', 'E08000030', 'E08000031', 'E08000032', 'E08000033'],
            bounds: [-2.0, 52.35, -1.5, 52.6]
        },
        {
            name: 'Leeds',
            lad_codes: ['E08000035', 'E08000036', 'E08000037', 'E08000038', 'E08000039', 'E08000040', 'E08000041', 'E08000042'],
            bounds: [-1.7, 53.7, -1.4, 53.9]
        },
        {
            name: 'Sheffield',
            lad_codes: ['E08000019', 'E08000020', 'E08000021', 'E08000022', 'E08000023', 'E08000024'],
            bounds: [-1.6, 53.3, -1.3, 53.5]
        },
        {
            name: 'Glasgow',
            lad_codes: ['S12000049', 'S12000050', 'S12000051', 'S12000052', 'S12000053', 'S12000054', 'S12000055', 'S12000056', 'S12000057', 'S12000058', 'S12000059', 'S12000060', 'S12000061', 'S12000062', 'S12000063', 'S12000064', 'S12000065'],
            bounds: [-4.4, 55.7, -3.9, 56.0]
        },
        {
            name: 'London',
            lad_codes: ['E09000001', 'E09000002', 'E09000003', 'E09000004', 'E09000005', 'E09000006', 'E09000007', 'E09000008', 'E09000009', 'E09000010', 'E09000011', 'E09000012', 'E09000013', 'E09000014', 'E09000015', 'E09000016', 'E09000017', 'E09000018', 'E09000019', 'E09000020', 'E09000021', 'E09000022', 'E09000023', 'E09000024', 'E09000025', 'E09000026', 'E09000027', 'E09000028', 'E09000029', 'E09000030', 'E09000031', 'E09000032', 'E09000033', 'E09000034', 'E09000035', 'E09000036', 'E09000037', 'E09000038', 'E09000039', 'E09000040', 'E09000041', 'E09000042', 'E09000043', 'E09000044', 'E09000045', 'E09000046', 'E09000047', 'E09000048', 'E09000049', 'E09000050'],
            bounds: [-0.3, 51.3, 0.3, 51.7]
        }
    ];

    // Load election results
    useEffect(() => {
        fetch('/data/election-results-2024.csv')
            .then(res => res.text())
            .then(csvText => {
                const lines = csvText.split('\n');
                const dataStart = lines.findIndex(line => line.includes('Local authority name'));
                const cleanedCsv = lines.slice(dataStart).join('\n');

                Papa.parse(cleanedCsv, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        console.log('CSV parsed, total rows:', results.data.length);

                        const wardWinners: Record<string, string> = {};
                        const allWardData: Record<string, WardData> = {};
                        const partyColumns = ['LAB', 'CON', 'LD', 'GREEN', 'REF', 'IND'];

                        results.data.forEach((row: any) => {
                            const wardCode = row['Ward code'];
                            if (!wardCode || wardCode.trim() === '') return;

                            const trimmedCode = wardCode.trim();
                            let maxVotes = 0;
                            let winningParty = 'OTHER';

                            const partyVotes: Record<string, number> = {};

                            partyColumns.forEach(party => {
                                const votes = parseInt(row[party]?.replace(/,/g, '') || '0');
                                partyVotes[party] = votes;
                                if (votes > maxVotes) {
                                    maxVotes = votes;
                                    winningParty = party;
                                }
                            });

                            wardWinners[trimmedCode] = winningParty;
                            allWardData[trimmedCode] = {
                                wardName: row['Ward name'] || 'Unknown',
                                ...partyVotes
                            };
                        });

                        console.log('Election results loaded:', Object.keys(wardWinners).length, 'wards');
                        setWardResults(wardWinners);
                        setWardData(allWardData);
                    },
                    error: (error) => {
                        console.error('CSV parse error:', error);
                    }
                });
            })
            .catch(err => {
                console.error('Error loading election results:', err);
            });
    }, []);

    // Initialize map and load all GeoJSON
    useEffect(() => {
        if (map.current) return;
        if (Object.keys(wardResults).length === 0) return;

        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

        if (!token) {
            setError('Missing NEXT_PUBLIC_MAPBOX_TOKEN environment variable.');
            setLoading(false);
            return;
        }

        mapboxgl.accessToken = token;

        if (mapContainer.current) {
            try {
                map.current = new mapboxgl.Map({
                    container: mapContainer.current,
                    style: 'mapbox://styles/mapbox/light-v11',
                    center: [-2.3, 53.5],
                    zoom: 10,
                });

                map.current.on('load', () => {
                    console.log('Map loaded successfully');

                    // Load all GeoJSON data
                    fetch('/data/Wards_December_2024_Boundaries_UK_BGC_-2654605954884295357.geojson')
                        .then(res => res.json())
                        .then(data => {
                            console.log('GeoJSON loaded, total features:', data.features?.length);
                            setAllGeoJSON(data);

                            // Set up initial location (Greater Manchester)
                            updateMapForLocation(locations[0], data);
                            setSelectedLocation(locations[0].name);
                        })
                        .catch(err => {
                            console.error('Error loading wards:', err);
                            setError(`Failed to load ward data: ${err.message}`);
                            setLoading(false);
                        });
                });

                map.current.on('error', (e) => {
                    console.error('Map error:', e);
                    setError(`Map error: ${e.error?.message || 'Unknown error'}`);
                    setLoading(false);
                });

                map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
            } catch (err) {
                console.error('Failed to initialize:', err);
                setError(`Failed to initialize map: ${err}`);
                setLoading(false);
            }
        }

        return () => {
            if (map.current) {
                map.current.remove();
                map.current = null;
            }
        };
    }, [wardResults, wardData]);

    const calculateLocationStats = (location: LocationBounds, geoData: any): ChartData => {
        const filteredFeatures = geoData.features.filter((f: any) =>
            location.lad_codes.includes(f.properties.LAD24CD)
        );

        const stats: ChartData = { LAB: 0, CON: 0, LD: 0, GREEN: 0, REF: 0, IND: 0 };

        filteredFeatures.forEach((feature: any) => {
            const wardCode = feature.properties.WD24CD;
            const data = wardData[wardCode];
            if (data) {
                stats.LAB += (data.LAB as number) || 0;
                stats.CON += (data.CON as number) || 0;
                stats.LD += (data.LD as number) || 0;
                stats.GREEN += (data.GREEN as number) || 0;
                stats.REF += (data.REF as number) || 0;
                stats.IND += (data.IND as number) || 0;
            }
        });

        return stats;
    };

    const updateMapForLocation = (location: LocationBounds, geoData: any) => {
        if (!map.current) return;

        // Calculate location-wide stats
        const locationStats = calculateLocationStats(location, geoData);
        setChartData(locationStats);
        setChartTitle(location.name);
        setChartWardCode('');

        // Filter features for this location
        const filteredFeatures = geoData.features.filter((f: any) =>
            location.lad_codes.includes(f.properties.LAD24CD)
        );

        const locationData = {
            type: 'FeatureCollection',
            features: filteredFeatures
        };

        // Add election results to features
        locationData.features.forEach((feature: any) => {
            const wardCode = feature.properties.WD24CD;
            feature.properties.winningParty = wardResults[wardCode] || 'NONE';
        });

        const partyColors: Record<string, string> = {
            'LAB': '#DC241f',
            'CON': '#0087DC',
            'LD': '#FAA61A',
            'GREEN': '#6AB023',
            'REF': '#12B6CF',
            'IND': '#CCCCCC',
            'OTHER': '#999999',
            'NONE': '#EEEEEE'
        };

        // Remove existing source and layers
        if (map.current.getSource('location-wards')) {
            if (map.current.getLayer('wards-fill')) map.current.removeLayer('wards-fill');
            if (map.current.getLayer('wards-line')) map.current.removeLayer('wards-line');
            map.current.removeSource('location-wards');
        }

        // Add new source
        map.current.addSource('location-wards', {
            type: 'geojson',
            data: locationData
        });

        // Add fill layer
        map.current.addLayer({
            id: 'wards-fill',
            type: 'fill',
            source: 'location-wards',
            paint: {
                'fill-color': [
                    'match',
                    ['get', 'winningParty'],
                    'LAB', partyColors.LAB,
                    'CON', partyColors.CON,
                    'LD', partyColors.LD,
                    'GREEN', partyColors.GREEN,
                    'REF', partyColors.REF,
                    'IND', partyColors.IND,
                    'OTHER', partyColors.OTHER,
                    partyColors.NONE
                ],
                'fill-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'hover'], false],
                    0.35,
                    0.6
                ]
            }
        });

        // Add line layer
        map.current.addLayer({
            id: 'wards-line',
            type: 'line',
            source: 'location-wards',
            paint: {
                'line-color': '#000',
                'line-width': 1,
                'line-opacity': 0.05
            }
        });

        const partyNames: Record<string, string> = {
            'LAB': 'Labour',
            'CON': 'Conservative',
            'LD': 'Liberal Democrat',
            'GREEN': 'Green',
            'REF': 'Reform',
            'IND': 'Independent',
            'OTHER': 'Other',
            'NONE': 'No data'
        };

        map.current.on('mousemove', 'wards-fill', (e) => {
            if (!map.current) return;
            map.current.getCanvas().style.cursor = 'pointer';

            if (e.features && e.features.length > 0) {
                const feature = e.features[0];
                const props = feature.properties;
                const wardCode = props.WD24CD;

                if (lastHoveredFeatureRef.current && lastHoveredFeatureRef.current.id !== feature.id) {
                    if (lastHoveredFeatureRef.current.id !== undefined) {
                        map.current.setFeatureState(
                            { source: 'location-wards', id: lastHoveredFeatureRef.current.id },
                            { hover: false }
                        );
                    }
                }

                if (feature.id !== undefined) {
                    map.current.setFeatureState(
                        { source: 'location-wards', id: feature.id },
                        { hover: true }
                    );
                    lastHoveredFeatureRef.current = feature;
                }

                if (currentWardRef.current === wardCode) return;

                currentWardRef.current = wardCode;

                // Update chart with ward data
                const data = wardData[wardCode];
                console.log('Hovering ward:', props.WD24NM, wardCode, 'Data:', data);
                console.log('Winning party:', props.winningParty, partyNames[props.winningParty] || 'Unknown');
                if (data) {
                    setChartData({
                        LAB: (data.LAB as number) || 0,
                        CON: (data.CON as number) || 0,
                        LD: (data.LD as number) || 0,
                        GREEN: (data.GREEN as number) || 0,
                        REF: (data.REF as number) || 0,
                        IND: (data.IND as number) || 0
                    });
                    setChartTitle((data.wardName as string) || 'Unknown Ward');
                    setChartWardCode((wardCode as string) || 'Unknown Ward Code');
                }
            }
        });

        map.current.on('mouseleave', 'wards-fill', () => {
            if (!map.current) return;

            if (lastHoveredFeatureRef.current && lastHoveredFeatureRef.current.id !== undefined) {
                map.current.setFeatureState(
                    { source: 'location-wards', id: lastHoveredFeatureRef.current.id },
                    { hover: false }
                );
                lastHoveredFeatureRef.current = null;
            }

            currentWardRef.current = null;
            // Reset chart to location stats
            const locationStats = calculateLocationStats(location, geoData);
            setChartData(locationStats);
            setChartTitle(location.name);
            setChartWardCode('');
        });

        console.log('Total wards loaded for location:', locationData.features.length);
        setLoading(false);
    };

    const handleLocationClick = (location: LocationBounds) => {
        setSelectedLocation(location.name);
        if (allGeoJSON) {
            updateMapForLocation(location, allGeoJSON);
            if (map.current) {
                map.current.fitBounds(location.bounds, {
                    padding: 40,
                    duration: 1000
                });
            }
        }
    };

    const maxVotes = Math.max(chartData.LAB, chartData.CON, chartData.LD, chartData.GREEN, chartData.REF, chartData.IND);

    const partyInfo = [
        { key: 'LAB', name: 'Labour', color: '#DC241f' },
        { key: 'CON', name: 'Conservative', color: '#0087DC' },
        { key: 'LD', name: 'Liberal Democrat', color: '#FAA61A' },
        { key: 'GREEN', name: 'Green', color: '#6AB023' },
        { key: 'REF', name: 'Reform', color: '#12B6CF' },
        { key: 'IND', name: 'Independent', color: '#CCCCCC' }
    ];

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="bg-white p-8 rounded-lg shadow-md max-w-md">
                    <h2 className="text-xl font-bold text-red-600 mb-4">Map Error</h2>
                    <p className="text-gray-700">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                    <div className="text-lg">Loading map...</div>
                </div>
            )}
            <div className="fixed inset-0 z-100 h-full w-full pointer-events-none">
                {/* Left pane */}
                <div className="absolute left-0 flex h-full">
                    <div className="pointer-events-auto p-[10px] w-[250px]">
                        <div className="bg-[rgba(255,255,255,0.8)] text-sm rounded-md backdrop-blur-md shadow-lg  max-h-[90vh] overflow-y-auto">
                            <div className="p-[10px] border-b border-gray-200">
                                <h2 className="font-semibold mb-4">Locations</h2>
                                <div className="space-y-2">
                                    {locations.map((location) => (
                                        <button
                                            key={location.name}
                                            onClick={() => handleLocationClick(location)}
                                            className={`w-full text-left px-3 py-1 rounded transition-colors text-xs ${selectedLocation === location.name
                                                    ? 'bg-blue-500 text-white'
                                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                                                }`}
                                        >
                                            {location.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="absolute right-0 flex h-full">
                    {/* Legend */}
                    <div className="pointer-events-none place-content-end py-[10px]">
                        <div className="bg-[rgba(255,255,255,0.8)] pointer-events-auto p-[10px] rounded-md backdrop-blur-md shadow-lg">
                            <h3 className="font-bold text-sm mb-2">Local Elections 2024</h3>
                            <div className="space-y-1 text-xs">
                                {partyInfo.map(party => (
                                    <div key={party.key} className="flex items-center gap-2">
                                        <div className="w-3 h-3" style={{ backgroundColor: party.color }}></div>
                                        <span>{party.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right pane */}
                    <div className="pointer-events-auto p-[10px] flex flex-col h-full w-[250px]">
                        <div className="bg-[rgba(255,255,255,0.8)] rounded-md backdrop-blur-md shadow-lg h-[100%] p-[10px] flex flex-col">
                            <div className="min-h-[60px]">
                                <h2 className="font-semibold text-sm">{chartTitle}</h2>
                                <div className="text-gray-500 text-xs">{chartWardCode}</div >
                            </div>
                            <div className="space-y-2">
                                {partyInfo.map(party => (
                                    <div key={party.key}>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-medium">{party.name}</span>
                                            <span className="text-xs font-bold">{(chartData[party.key as keyof ChartData] as number).toLocaleString()}</span>
                                        </div>
                                        <div className="h-6 bg-gray-200 rounded overflow-hidden">
                                            <div
                                                style={{
                                                    height: '100%',
                                                    width: maxVotes > 0 ? ((chartData[party.key as keyof ChartData] as number) / maxVotes * 100) : 0,
                                                    backgroundColor: party.color,
                                                    transition: 'width 0.3s ease'
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
            <div
                ref={mapContainer}
                style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
            />
        </div>
    );
}