import { useIsDark } from "@/lib/context/ThemeContext";
import { panelTheme } from "@/lib/helpers/panelTheme";
import { LOCATIONS } from "@lib/data/locations";
import {
	LocationBounds,
	BoundaryGeojson,
	PopulationDataset,
	PopulationWardData,
} from "@lib/types";
import {
	memo,
	useEffect,
	useMemo,
	useState,
	useTransition,
	useDeferredValue,
	useRef,
} from "react";
import {
	fetchBoundaryFile,
	GEOJSON_PATHS,
	getProp,
	PROPERTY_KEYS,
} from "@lib/data/boundaries/boundaries";

interface LocationPanelProps {
	selectedLocation: string | null;
	onLocationClick: (location: string, bounds: LocationBounds) => void;
	populationDataset: PopulationDataset;
}

const COUNTRY_LOCATIONS = new Set([
	"England",
	"Scotland",
	"Wales",
	"Northern Ireland",
	"United Kingdom",
]);

/**
 * Calculate total population for a ward
 */
const calculateWardPopulation = (wardData: PopulationWardData): number => {
	return Object.values(wardData.total).reduce(
		(sum: number, val: number) => sum + val,
		0,
	);
};

/**
 * Calculate bounds from a GeoJSON feature
 */
const calculateFeatureBounds = (
	feature: BoundaryGeojson["features"][0],
): [number, number, number, number] => {
	if (!feature?.geometry) {
		return [-1, -1, -1, -1];
	}

	let minLng = Infinity,
		minLat = Infinity,
		maxLng = -Infinity,
		maxLat = -Infinity;

	type Coords = number[] | number[][] | number[][][];

	const processCoords = (coords: Coords): void => {
		if (typeof coords[0] === "number") {
			const [lng, lat] = coords as [number, number];
			minLng = Math.min(minLng, lng);
			maxLng = Math.max(maxLng, lng);
			minLat = Math.min(minLat, lat);
			maxLat = Math.max(maxLat, lat);
		} else {
			(coords as number[][] | number[][][]).forEach((c) => processCoords(c as Coords));
		}
	};

	processCoords(feature.geometry.coordinates);
	return [minLng, minLat, maxLng, maxLat];
};

export default memo(function LocationPanel({
	selectedLocation,
	onLocationClick,
	populationDataset,
}: LocationPanelProps) {
	const [geojson, setGeojson] = useState<BoundaryGeojson | null>(null);
	const [searchOpen, setSearchOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [isPending, startTransition] = useTransition();
	const inputRef = useRef<HTMLInputElement>(null);

	// Defer search query for non-blocking updates
	const deferredSearchQuery = useDeferredValue(searchQuery);

	// Load ward boundaries using the library
	useEffect(() => {
		fetchBoundaryFile(GEOJSON_PATHS.ward[2023])
			.then((data) => setGeojson(data))
			.catch((err) =>
				console.error("Failed to load ward boundaries:", err),
			);
	}, []);

	// Build a map of ward code -> feature for quick lookups
	const geojsonFeatureMap = useMemo(() => {
		if (!geojson) return {};

		const map: Record<string, BoundaryGeojson["features"][0]> = {};
		geojson.features.forEach((feature) => {
			const wardCode = getProp(
				feature.properties,
				PROPERTY_KEYS.wardCode,
			);
			if (wardCode) {
				map[wardCode] = feature;
			}
		});

		return map;
	}, [geojson]);

	// Enrich population data with geographic bounds and pre-calculated totals
	const enrichedPopulation = useMemo(() => {
		const enriched: Record<
			string,
			PopulationWardData & {
				bounds: [number, number, number, number];
				totalPopulation: number;
			}
		> = {};

		Object.entries(populationDataset.data).forEach(
			([wardCode, wardData]) => {
				const feature = geojsonFeatureMap[wardCode];
				const bounds: [number, number, number, number] = feature
					? calculateFeatureBounds(feature)
					: [-1, -1, -1, -1];
				const totalPopulation = calculateWardPopulation(wardData);

				enriched[wardCode] = {
					...wardData,
					bounds,
					totalPopulation,
				};
			},
		);

		return enriched;
	}, [populationDataset, geojsonFeatureMap]);

	// Calculate population totals for each location
	const locationPopulations = useMemo(() => {
		const populations = new Map<string, number>();

		// Initialize country populations
		const countryPops: Record<string, number> = {
			"United Kingdom": 0,
			England: 0,
			Scotland: 5479900,
			Wales: 0,
			"Northern Ireland": 1903175,
		};

		// Single pass through all wards to calculate country totals
		Object.entries(enrichedPopulation).forEach(
			([wardCode, wardData]) => {
				const population = wardData.totalPopulation;

				countryPops["United Kingdom"] += population;

				// Assign to country based on ward code prefix
				if (wardCode.startsWith("E"))
					countryPops["England"] += population;
				else if (wardCode.startsWith("S"))
					countryPops["Scotland"] += population;
				else if (wardCode.startsWith("W"))
					countryPops["Wales"] += population;
				else if (wardCode.startsWith("N"))
					countryPops["Northern Ireland"] += population;
			},
		);

		// Store country populations
		Object.entries(countryPops).forEach(([country, pop]) => {
			populations.set(country, pop);
		});

		// Calculate LAD-based location populations
		Object.entries(LOCATIONS).forEach(([location, bounds]) => {
			if (COUNTRY_LOCATIONS.has(location)) return; // Already calculated

			if (bounds.lad_codes && bounds.lad_codes.length > 0) {
				let total = 0;
				Object.values(enrichedPopulation).forEach((wardData) => {
					if (bounds.lad_codes.includes(wardData.ladCode)) {
						total += wardData.totalPopulation;
					}
				});
				populations.set(location, total);
			}
		});

		return populations;
	}, [enrichedPopulation]);

	// Build the complete list of locations with populations
	const allLocations = useMemo(() => {
		const locations = Object.entries(LOCATIONS)
			.map(([location, bounds]) => ({
				name: location,
				totalPopulation: locationPopulations.get(location) || 0,
				bounds,
			}))
			.filter(({ totalPopulation }) => totalPopulation > 0)
			.sort((a, b) => b.totalPopulation - a.totalPopulation);

		return locations;
	}, [locationPopulations]);

	// Filter locations based on search query
	const filteredLocations = useMemo(() => {
		if (!deferredSearchQuery.trim()) return allLocations;

		const query = deferredSearchQuery.toLowerCase();
		return allLocations.filter(({ name }) =>
			name.toLowerCase().includes(query),
		);
	}, [allLocations, deferredSearchQuery]);

	const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setSearchQuery(e.target.value);
	};

	const handleSearchToggle = () => {
		startTransition(() => {
			const newSearchOpen = !searchOpen;
			setSearchOpen(newSearchOpen);
			if (!newSearchOpen) {
				setSearchQuery("");
			} else {
				setTimeout(() => inputRef.current?.focus(), 0);
			}
		});
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && filteredLocations.length > 0) {
			const location = filteredLocations[0];
			onLocationClick(location.name, location.bounds);
		} else if (e.key === "Escape" && searchOpen) {
			handleSearchToggle();
		}
	};

	const isDark = useIsDark();
	const t = panelTheme(isDark);

	return (
		<div className={`rounded-md backdrop-blur-md shadow-lg border flex flex-col h-full ${t.panel}`}>
			{/* Header with search */}
			<div className={`shrink-0 ${t.section} flex items-center overflow-hidden`}>
				<h2 className={`px-2.5 pb-2 pt-2.5 text-sm font-semibold grow ${t.heading}`}>
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
							className={`outline-none text-xs px-1 py-1 mt-0.5 transition-all border-b! border-white/20 duration-200 w-full bg-transparent ${t.text} ${searchOpen ? "opacity-100" : "opacity-0 px-0"}`}
						/>
					</div>
					<button
						onClick={handleSearchToggle}
						className={`mr-3 ml-2 transition-colors cursor-pointer ${t.textMuted} hover:${isDark ? "text-gray-200" : "text-gray-600"}`}
					>
						{searchOpen ? (
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								strokeWidth="2"
								stroke="currentColor"
								className="h-4.5"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						) : (
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								strokeWidth="2"
								stroke="currentColor"
								className="h-4.5"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
								/>
							</svg>
						)}
					</button>
				</div>
			</div>

			{/* Scrollable location list */}
			<div className="overflow-y-auto scroll-container flex-1 px-1 py-1 pt-0.5">
				{filteredLocations.map(({ name, totalPopulation, bounds }) => (
					<button
						key={name}
						onClick={() => onLocationClick(name, bounds)}
						className={`w-full text-left px-2 py-1 rounded transition-all duration-200 text-xs cursor-pointer flex justify-between items-center ${selectedLocation === name
								? isDark ? "bg-white/15 text-gray-100" : "bg-white/60 text-gray-800"
								: isDark ? "hover:bg-white/10 text-gray-400 hover:text-gray-200" : "hover:bg-white/40 text-gray-600 hover:text-gray-800"
							}`}
					>
						<span className="font-normal truncate mr-2">
							{name}
						</span>
						<span className={`text-xs tabular-nums shrink-0 ${t.textMuted}`}>
							{totalPopulation.toLocaleString()}
						</span>
					</button>
				))}
			</div>
		</div>
	);
});
