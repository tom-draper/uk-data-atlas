import { LOCATIONS } from "@/lib/data/locations";
import { WardGeojson } from "@/lib/hooks/useWardDatasets";
import { LocationBounds, PopulationWardData } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

interface LocationPanelProps {
    selectedLocation: string | null;
    onLocationClick: (location: LocationBounds) => void;
    population: PopulationWardData;
}

export default function LocationPane({ selectedLocation, onLocationClick, population }: LocationPanelProps) {
    // Add state for 2021 geojson
    const [geojson2021, setGeojson2021] = useState<WardGeojson | null>(null);

    // Load it once
    useEffect(() => {
        fetch('/data/wards/Wards_December_2021_UK_BGC_2022_-3127229614810050524.geojson')
            .then(r => r.json())
            .then(data => setGeojson2021(data))
            .catch(err => console.error('Failed to load 2021 geojson:', err));
    }, []);

    const populationWithBounds = useMemo(() => {
        if (!geojson2021 || !population) return population;

        // Create enriched population data with bounds
        const enriched: any = {};

        Object.entries(population).forEach(([wardCode, wardData]: [string, any]) => {
            // Find the matching feature in 2021 geojson
            const feature = geojson2021.features.find((f: any) =>
                f.properties.WD21CD === wardCode
            );

            let bounds: [number, number, number, number] = [-1, -1, -1, -1];

            if (feature?.geometry) {
                // Calculate bounds from geometry coordinates
                const coords = feature.geometry.coordinates;

                // Initialize with extreme values
                let minLng = Infinity;
                let minLat = Infinity;
                let maxLng = -Infinity;
                let maxLat = -Infinity;

                // Helper function to process coordinates recursively
                const processCoords = (coordArray: any) => {
                    if (typeof coordArray[0] === 'number') {
                        // This is a [lng, lat] pair
                        const [lng, lat] = coordArray;
                        minLng = Math.min(minLng, lng);
                        maxLng = Math.max(maxLng, lng);
                        minLat = Math.min(minLat, lat);
                        maxLat = Math.max(maxLat, lat);
                    } else {
                        // This is an array of coordinates, recurse
                        coordArray.forEach(processCoords);
                    }
                };

                processCoords(coords);

                // Mapbox bounds format: [west, south, east, north]
                bounds = [minLng, minLat, maxLng, maxLat];
            }

            enriched[wardCode] = {
                ...wardData,
                bounds,
            };
        });

        return enriched;
    }, [population, geojson2021]);

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

    // Convert larger locations to the same format
    // const largerLocations = useMemo(() => {
    //     return LOCATIONS.map(location => ({
    //         wardCode: location.name, // Use name as unique key
    //         wardName: location.name,
    //         laName: '', // No LA name for larger areas
    //         totalPopulation: 0, // Could calculate if needed
    //         isWard: false,
    //         bounds: location,
    //     }));
    // }, []);

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

    // Combine and sort: larger locations first, then wards by population
    const sortedLocations = useMemo(() => {
        return [
            ...largerLocations,
            ...wardLocations
        ].sort((a, b) => b.totalPopulation - a.totalPopulation);
    }, [largerLocations, wardLocations]);

    return (
        <div className="bg-[rgba(255,255,255,0.6)] text-sm rounded-md backdrop-blur-md shadow-lg flex flex-col h-full">
            <div className="p-[10px] border-b border-gray-200 flex-shrink-0">
                <h2 className="font-semibold mb-2">Locations</h2>
            </div>

            {/* Scrollable list */}
            <div className="overflow-y-auto flex-1 p-[10px] space-y-[2px]">
                {sortedLocations.map(({ wardCode, wardName, totalPopulation, bounds }) => (
                    <button
                        key={wardCode}
                        onClick={() => onLocationClick(bounds)}
                        className={`w-full text-left py-[4px] rounded transition-colors text-xs cursor-pointer flex justify-between ${selectedLocation === wardName
                            ? 'text-black font-medium'
                            : 'hover:text-black text-[gray]'
                            }`}
                    >
                        <span>{wardName}</span>
                        <span className="text-[gray]">{totalPopulation.toLocaleString()}</span>
                    </button>
                ))}
            </div>
        </div>
    )
}