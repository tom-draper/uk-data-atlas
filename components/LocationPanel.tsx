import { LOCATIONS } from "@lib/data/locations";
import { LocationBounds, BoundaryGeojson, PopulationDataset } from "@lib/types";
import { memo, useEffect, useMemo, useState, useTransition, useDeferredValue, useRef } from "react";

interface LocationPanelProps {
    selectedLocation: string | null;
    onLocationClick: (location: string, bounds: LocationBounds) => void;
    population: PopulationDataset | null;
}

const COUNTRY_LOCATIONS = new Set(['England', 'Scotland', 'Wales', 'Northern Ireland', 'United Kingdom']);

// Pre-calculate ward population once
const calculateWardPopulation = (wardData: any): number => {
    return Object.values(wardData.total).reduce(
        (sum: number, val: any) => sum + Number(val),
        0
    );
};

export default memo(function LocationPanel({ selectedLocation, onLocationClick, population }: LocationPanelProps) {
    const [geojson, setGeojson] = useState<BoundaryGeojson<2023> | null>(null);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isPending, startTransition] = useTransition();
    const inputRef = useRef<HTMLInputElement>(null);
    
    // Defer search query for non-blocking updates
    const deferredSearchQuery = useDeferredValue(searchQuery);

    useEffect(() => {
        console.log('EXPENSIVE: Loading 2023 geojson for LocationPanel...');
        fetch('/data/boundaries/wards/Wards_December_2023_Boundaries_UK_BGC_-915726682161155301.geojson')
            .then(r => r.json())
            .then(data => setGeojson(data))
            .catch(err => console.error('Failed to load 2023 geojson:', err));
    }, []);

    // Memoize geojson feature map (only depends on geojson)
    const geojsonFeatureMap = useMemo(() => {
        if (!geojson) return {};

        const map: Record<string, any> = {};
        geojson.features.forEach(f => {
            map[f.properties.WD23CD] = f;
        });

        return map;
    }, [geojson]);

    // Pre-enrich population data with bounds and calculated totals - only recalculate when population changes
    const enrichedPopulation = useMemo(() => {
        if (!population) return {};

        const enriched: Record<string, any> = {};
        
        Object.entries(population.populationData).forEach(([wardCode, wardData]) => {
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

            // Pre-calculate total population
            const totalPopulation = calculateWardPopulation(wardData);

            enriched[wardCode] = { 
                ...wardData, 
                bounds,
                totalPopulation // Cache this!
            };
        });

        return enriched;
    }, [population, geojsonFeatureMap]);

    // Calculate location populations once and cache
    const locationPopulations = useMemo(() => {
        const populations = new Map<string, number>();

        // Pre-calculate country populations
        const countryPops: Record<string, number> = {
            'United Kingdom': 0,
            'England': 0,
            'Scotland': 0,
            'Wales': 0,
            'Northern Ireland': 0
        };

        // Single pass through all wards
        Object.entries(enrichedPopulation).forEach(([wardCode, wardData]: [string, any]) => {
            const pop = wardData.totalPopulation;

            // Add to UK total
            countryPops['United Kingdom'] += pop;

            // Add to country totals based on prefix
            if (wardCode.startsWith('E')) countryPops['England'] += pop;
            else if (wardCode.startsWith('S')) countryPops['Scotland'] += pop;
            else if (wardCode.startsWith('W')) countryPops['Wales'] += pop;
            else if (wardCode.startsWith('N')) countryPops['Northern Ireland'] += pop;
        });

        Object.entries(countryPops).forEach(([country, pop]) => {
            populations.set(country, pop);
        });

        // Calculate LAD-based location populations
        Object.entries(LOCATIONS).forEach(([location, bounds]) => {
            if (COUNTRY_LOCATIONS.has(location)) return; // Already calculated

            if (bounds.lad_codes && bounds.lad_codes.length > 0) {
                let total = 0;
                Object.values(enrichedPopulation).forEach((wardData: any) => {
                    if (bounds.lad_codes.includes(wardData.laCode)) {
                        total += wardData.totalPopulation;
                    }
                });
                populations.set(location, total);
            }
        });

        return populations;
    }, [enrichedPopulation]);

    // Build location list once
    const allLocations = useMemo(() => {
        const locations = Object.entries(LOCATIONS)
            .map(([location, bounds]) => ({
                name: location,
                wardCode: '',
                wardName: '',
                laName: '',
                totalPopulation: locationPopulations.get(location) || 0,
                bounds,
            }))
            .filter(({ totalPopulation }) => totalPopulation > 0);

        // Sort once
        return locations.sort((a, b) => b.totalPopulation - a.totalPopulation);
    }, [locationPopulations]);

    // Filter with deferred value for smooth typing
    const filteredLocations = useMemo(() => {
        if (!deferredSearchQuery.trim()) return allLocations;

        const query = deferredSearchQuery.toLowerCase();
        return allLocations.filter(({ name }) =>
            name.toLowerCase().includes(query)
        );
    }, [allLocations, deferredSearchQuery]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        // Update immediately for input responsiveness
        setSearchQuery(value);
    };

    const handleSearchToggle = () => {
        startTransition(() => {
            const newSearchOpen = !searchOpen;
            setSearchOpen(newSearchOpen);
            if (!newSearchOpen) {
                setSearchQuery('');
            } else {
                // Focus input when opening
                setTimeout(() => inputRef.current?.focus(), 0);
            }
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const location = filteredLocations[0];
            onLocationClick(location.name, location.bounds);
        } else if (e.key === 'Esc' && searchOpen) {
            handleSearchToggle()
        }
    };

    return (
        <div className="bg-[rgba(255,255,255,0.5)] rounded-md backdrop-blur-md shadow-lg border border-white/30 flex flex-col h-full">
            <div className="shrink-0 bg-white/20 flex items-center overflow-hidden">
                <h2 className="px-2.5 pb-2 pt-2.5 text-sm font-semibold grow">
                    Locations
                </h2>
                <div className="flex items-center transition-all duration-200">
                    <div className="grow">
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchQuery}
                            onChange={handleSearchChange}
                            onKeyDown={handleKeyDown}
                            placeholder="Search locations..."
                            className={`outline-none text-gray-500 text-xs px-1 py-1 mt-0.5 transition-all border-b! border-gray-200/20 duration-200 w-full ${
                                searchOpen ? 'opacity-100' : 'opacity-0 px-0'
                            }`}
                        />
                    </div>
                    <button
                        onClick={handleSearchToggle}
                        className="text-gray-400/80 mr-3 ml-2 hover:text-gray-600 transition-colors cursor-pointer"
                    >
                        {searchOpen ? (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="h-[18px]">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="h-[18px]">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>

            {/* Scrollable list */}
            <div className="overflow-y-auto scroll-container flex-1 px-1 py-1 pt-0.5">
                {filteredLocations.map(({ name, wardCode, totalPopulation, bounds }) => (
                    <button
                        key={name + wardCode}
                        onClick={() => onLocationClick(name, bounds)}
                        className={`w-full text-left px-2 py-1 rounded transition-all duration-200 text-xs cursor-pointer flex justify-between items-center ${
                            selectedLocation === name
                                ? 'bg-white/60 text-gray-800'
                                : 'hover:bg-white/40 text-gray-600 hover:text-gray-800'
                        }`}
                    >
                        <span className="font-normal truncate mr-2">{name}</span>
                        <span className="text-gray-500 text-xs tabular-nums shrink-0">
                            {totalPopulation.toLocaleString()}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
});