import { LOCATIONS } from "@lib/data/locations";
import { WardGeojson } from "@lib/hooks/useWardDatasets";
import { LocationBounds, PopulationWardData } from "@lib/types";
import { memo, useEffect, useMemo, useState } from "react";

interface LocationPanelProps {
    selectedLocation: string | null;
    onLocationClick: (location: LocationBounds) => void;
    population: PopulationWardData;
}

export default memo(function LocationPane({ selectedLocation, onLocationClick, population }: LocationPanelProps) {
    // Add state for 2021 geojson - population data uses the 2021 ward codes and boundaries
    const [geojson2021, setGeojson2021] = useState<WardGeojson | null>(null);

    // Load it once
    useEffect(() => {
        fetch('/data/wards/Wards_December_2021_UK_BGC_2022_-3127229614810050524.geojson')
            .then(r => r.json())
            .then(data => setGeojson2021(data))
            .catch(err => console.error('Failed to load 2021 geojson:', err));
    }, []);

    const geojsonFeatureMap = useMemo(() => {
        if (!geojson2021) return {};

        const map: Record<string, any> = {};
        geojson2021.features.forEach(f => {
            map[f.properties.WD21CD] = f;
        });

        return map;
    }, [geojson2021]);

    const populationWithBounds = useMemo(() => {
        if (!geojson2021 || !population) return population;

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
                    wardCode,
                    wardName: wardData.wardName,
                    laName: wardData.laName,
                    totalPopulation,
                    isWard: true,
                    bounds: {
                        name: wardData.wardName,
                        lad_codes: [wardData.laCode],
                        bounds: wardData.bounds || [-1, -1, -1, -1]
                    } as LocationBounds,
                };
            })
            .filter(({ bounds }) => bounds.bounds[0] !== -1);
    }, [populationWithBounds]);

    // Convert larger locations to the same format with calculated population
    const largerLocations = useMemo(() => {
        return LOCATIONS.map(location => {
            // Calculate total population by summing all wards in the constituent LADs
            const totalPopulation = Object.values(populationWithBounds).reduce((sum: number, wardData: any) => {
                // Check if this ward belongs to any of the LADs in this location
                if (location.lad_codes.includes(wardData.laCode)) {
                    const wardPop = Object.values(wardData.total).reduce(
                        (wardSum: number, val: any) => wardSum + Number(val),
                        0
                    );
                    return sum + wardPop;
                }
                return sum;
            }, 0);

            return {
                wardCode: location.name,
                wardName: location.name,
                laName: '',
                totalPopulation,
                isWard: false,
                bounds: location,
            };
        });
    }, [populationWithBounds]);

    const sortedLocations = useMemo(() => {
        if (!largerLocations.length || !wardLocations.length) return [];

        return [
            ...largerLocations,
            ...wardLocations
        ].sort((a, b) => b.totalPopulation - a.totalPopulation);
    }, [largerLocations, wardLocations]);

    return (
        <div className="bg-[rgba(255,255,255,0.5)] rounded-lg backdrop-blur-xl shadow-xl border border-white/30 flex flex-col h-full">
            <div className="shrink-0 bg-white/20">
                <h2 className="px-2.5 pb-2 pt-2.5 text-sm font-semibold">Locations</h2>
            </div>

            {/* Scrollable list */}
            <div className="overflow-y-auto scroll-container flex-1 px-1 py-1 pt-0.5">
                {sortedLocations.map(({ wardCode, wardName, totalPopulation, bounds }) => (
                    <button
                        key={wardCode}
                        onClick={() => onLocationClick(bounds)}
                        className={`w-full text-left px-2 py-1 rounded transition-all duration-200 text-xs cursor-pointer flex justify-between items-center ${selectedLocation === wardName
                            ? 'bg-white/60 text-gray-800'
                            : 'hover:bg-white/40 text-gray-600 hover:text-gray-800'
                            }`}
                    >
                        <span className="font-normal truncate mr-2">{wardName}</span>
                        <span className="text-gray-500 text-xs tabular-nums shrink-0">{totalPopulation.toLocaleString()}</span>
                    </button>
                ))}
            </div>
        </div>
    )
})