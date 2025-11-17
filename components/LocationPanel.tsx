import { LOCATIONS } from "@lib/data/locations";
import { LocationBounds, BoundaryGeojson, PopulationDataset } from "@lib/types";
import { memo, useEffect, useMemo, useState } from "react";

interface LocationPanelProps {
    selectedLocation: string | null;
    onLocationClick: (location: string, bounds: LocationBounds) => void;
    population: PopulationDataset['populationData'];
}

const COUNTRY_PREFIXES: Record<string, string> = {
    'United Kingdom': '',
    'England': 'E',
    'Scotland': 'S',
    'Wales': 'W',
    'Northern Ireland': 'N'
};

const COUNTRY_LOCATIONS = new Set(['England', 'Scotland', 'Wales', 'Northern Ireland', 'United Kingdom']);

export default memo(function LocationPanel({ selectedLocation, onLocationClick, population }: LocationPanelProps) {
    // Add state for 2023 geojson - population data uses the 2023 ward codes and boundaries
    const [geojson, setGeojson] = useState<BoundaryGeojson<2023> | null>(null);

    // Load it once
    useEffect(() => {
        console.log('EXPENSIVE: Loading 2023 geojson for LocationPanel...');
        fetch('/data/boundaries/wards/Wards_December_2023_Boundaries_UK_BGC_-915726682161155301.geojson')
            .then(r => r.json())
            .then(data => setGeojson(data))
            .catch(err => console.error('Failed to load 2023 geojson:', err));
    }, []);

    const geojsonFeatureMap = useMemo(() => {
        if (!geojson) return {};

        const map: Record<string, any> = {};
        geojson.features.forEach(f => {
            map[f.properties.WD23CD] = f;
        });

        return map;
    }, [geojson]);

    const populationWithBounds = useMemo(() => {
        if (!geojson || !population) return population;

        const enriched: any = {};
        Object.entries(population).forEach(([wardCode, wardData]) => {
            const feature = geojsonFeatureMap[wardCode];
            let bounds: [number, number, number, number] = [-1, -1, -1, -1];

            if (feature?.geometry) {
                let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;

                const processCoords = (coords: any) => {
                    if (typeof coords[0] === 'number') {
                        const [lng, lat] = coords;
                        minLng = Math.min(minLng, lng);
                        maxLng = Math.max(maxLng, lng);
                        minLat = Math.min(minLat, lat);
                        maxLat = Math.max(maxLat, lat);
                    } else {
                        coords.forEach(processCoords);
                    }
                };

                processCoords(feature.geometry.coordinates);
                bounds = [minLng, minLat, maxLng, maxLat];
            }

            enriched[wardCode] = { ...wardData, bounds };
        });

        return enriched;
    }, [population, geojsonFeatureMap]);

    // Convert population object into an array of ward locations
    const wardLocations = useMemo(() => {
        return Object.entries(populationWithBounds)
            .map(([wardCode, wardData]: [string, any]) => {
                const totalPopulation = Object.values(wardData.total).reduce(
                    (sum: number, val: any) => sum + Number(val),
                    0
                );
                return {
                    name: wardData.wardName,
                    wardCode: wardCode,
                    wardName: wardData.wardName,
                    laName: wardData.laName,
                    totalPopulation,
                    bounds: {
                        lad_codes: [wardData.laCode],
                        bounds: wardData.bounds || [-1, -1, -1, -1]
                    },
                };
            })
            .filter(({ bounds }) => bounds.bounds[0] !== -1);
    }, [populationWithBounds]);

    // Calculate population for a location based on LAD codes or country prefix
    const calculateLocationPopulation = (location: string, locationBounds: LocationBounds): number => {
        // Country-level filtering by ward code prefix
        if (COUNTRY_LOCATIONS.has(location)) {
            return Object.entries(populationWithBounds).reduce((sum: number, [wardCode, wardData]: [string, any]) => {
                // United Kingdom = all wards
                if (location === 'United Kingdom') {
                    const wardPop = Object.values(wardData.total).reduce(
                        (wardSum: number, val: any) => wardSum + Number(val),
                        0
                    );
                    return sum + wardPop;
                }

                // Other countries - filter by prefix
                const prefix = COUNTRY_PREFIXES[location];
                if (prefix && wardCode.startsWith(prefix)) {
                    const wardPop = Object.values(wardData.total).reduce(
                        (wardSum: number, val: any) => wardSum + Number(val),
                        0
                    );
                    return sum + wardPop;
                }

                return sum;
            }, 0);
        }

        // Specific location filtering by LAD codes
        if (locationBounds.lad_codes && locationBounds.lad_codes.length > 0) {
            return Object.values(populationWithBounds).reduce((sum: number, wardData: any) => {
                if (locationBounds.lad_codes.includes(wardData.laCode)) {
                    const wardPop = Object.values(wardData.total).reduce(
                        (wardSum: number, val: any) => wardSum + Number(val),
                        0
                    );
                    return sum + wardPop;
                }
                return sum;
            }, 0);
        }

        return 0;
    };

    // Convert larger locations to the same format with calculated population
    const largerLocations = useMemo(() => {
        return Object.entries(LOCATIONS)
            .map(([location, bounds]) => {
                const totalPopulation = calculateLocationPopulation(location, bounds);

                return {
                    name: location,
                    wardCode: '',
                    wardName: '',
                    laName: '',
                    totalPopulation,
                    bounds,
                };
            })
            .filter(({ totalPopulation }) => totalPopulation > 0); // Filter out zero population
    }, [populationWithBounds]);

    const sortedLocations = useMemo(() => {
        if (!largerLocations.length) return [];

        return [
            ...largerLocations,
            ...wardLocations  // Uncomment to include individual wards
        ].sort((a, b) => b.totalPopulation - a.totalPopulation);
    }, [largerLocations]);

    return (
        <div className="bg-[rgba(255,255,255,0.5)] rounded-lg backdrop-blur-xl shadow-xl border border-white/30 flex flex-col h-full">
            <div className="shrink-0 bg-white/20">
                <h2 className="px-2.5 pb-2 pt-2.5 text-sm font-semibold">Locations</h2>
            </div>

            {/* Scrollable list */}
            <div className="overflow-y-auto scroll-container flex-1 px-1 py-1 pt-0.5">
                {sortedLocations.map(({ name, wardCode, totalPopulation, bounds }) => (
                    <button
                        key={name + wardCode}
                        onClick={() => onLocationClick(name, bounds)}
                        className={`w-full text-left px-2 py-1 rounded transition-all duration-200 text-xs cursor-pointer flex justify-between items-center ${selectedLocation === name
                            ? 'bg-white/60 text-gray-800'
                            : 'hover:bg-white/40 text-gray-600 hover:text-gray-800'
                            }`}
                    >
                        <span className="font-normal truncate mr-2">{name}</span>
                        <span className="text-gray-500 text-xs tabular-nums shrink-0">{totalPopulation.toLocaleString()}</span>
                    </button>
                ))}
            </div>
        </div>
    )
})