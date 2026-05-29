import { useIsDark } from "@/lib/context/ThemeContext";
import { panelTheme, glassStyle, glassSpecular } from "@/lib/helpers/panelTheme";
import { LOCATIONS } from "@lib/data/locations";
import {
	LocationBounds,
	BoundaryGeojson,
	PopulationDataset,
	PopulationWardData,
} from "@lib/types";
import {
	useEffect,
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
			(coords as number[][] | number[][][]).forEach((c) =>
				processCoords(c as Coords),
			);
		}
	};

	processCoords(feature.geometry.coordinates);
	return [minLng, minLat, maxLng, maxLat];
};

export default function LocationPanel({
	selectedLocation,
	onLocationClick,
	populationDataset,
}: LocationPanelProps) {
	const [geojson, setGeojson] = useState<BoundaryGeojson | null>(null);
	const [searchOpen, setSearchOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [isPending, startTransition] = useTransition();
	const inputRef = useRef<HTMLInputElement>(null);

	const deferredSearchQuery = useDeferredValue(searchQuery);

	useEffect(() => {
		fetchBoundaryFile(GEOJSON_PATHS.ward[2023])
			.then((data) => setGeojson(data))
			.catch((err) =>
				console.error("Failed to load ward boundaries:", err),
			);
	}, []);

	const geojsonFeatureMap = (() => {
		if (!geojson) return {} as Record<string, BoundaryGeojson["features"][0]>;

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
	})();

	const enrichedPopulation = (() => {
		const enriched: Record<
			string,
			PopulationWardData & {
				bounds: [number, number, number, number];
				totalPopulation: number;
			}
		> = {};

		Object.entries(populationDataset.data).forEach(
			([wardCode, wardData]: [string, PopulationWardData]) => {
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
	})();

	const locationPopulations = (() => {
		const populations = new Map<string, number>();

		const countryPops: Record<string, number> = {
			"United Kingdom": 0,
			England: 0,
			Scotland: 5479900,
			Wales: 0,
			"Northern Ireland": 1903175,
		};

		Object.entries(enrichedPopulation).forEach(([wardCode, wardData]) => {
			const population = wardData.totalPopulation;

			countryPops["United Kingdom"] += population;

			if (wardCode.startsWith("E")) countryPops["England"] += population;
			else if (wardCode.startsWith("S"))
				countryPops["Scotland"] += population;
			else if (wardCode.startsWith("W"))
				countryPops["Wales"] += population;
			else if (wardCode.startsWith("N"))
				countryPops["Northern Ireland"] += population;
		});

		Object.entries(countryPops).forEach(([country, pop]) => {
			populations.set(country, pop);
		});

		Object.entries(LOCATIONS).forEach(([location, bounds]) => {
			if (COUNTRY_LOCATIONS.has(location)) return;

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
	})();

	const allLocations = (() => {
		return Object.entries(LOCATIONS)
			.flatMap(([location, bounds]) => {
				const totalPopulation = locationPopulations.get(location) || 0;
				if (totalPopulation <= 0) return [];
				return [{ name: location, totalPopulation, bounds }];
			})
			.sort((a, b) => b.totalPopulation - a.totalPopulation);
	})();

	const filteredLocations = (() => {
		if (!deferredSearchQuery.trim()) return allLocations;

		const query = deferredSearchQuery.toLowerCase();
		return allLocations.filter(({ name }: { name: string }) =>
			name.toLowerCase().includes(query),
		);
	})();

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
		<div
			className={`rounded-md flex flex-col h-full relative overflow-hidden ${isDark ? "text-gray-100" : "text-gray-800"}`}
			style={glassStyle(isDark)}
		>
			{/* Specular highlight overlay */}
			<div style={glassSpecular(isDark)} />
			{/* SVG distortion filter definition */}
			<svg className="absolute w-0 h-0" aria-hidden="true">
				<defs>
					<filter id="lp-glass-distortion" x="-10%" y="-10%" width="120%" height="120%">
						<feTurbulence type="fractalNoise" baseFrequency="0.018 0.025" numOctaves="2" seed="5" result="noise" />
						<feDisplacementMap in="SourceGraphic" in2="noise" scale="4" xChannelSelector="R" yChannelSelector="G" />
					</filter>
				</defs>
			</svg>
			{/* Content sits above overlays */}
			<div className="relative flex flex-col h-full" style={{ zIndex: 1 }}>
			{/* Header with search */}
			<div
				className={`shrink-0 ${t.section} flex items-center overflow-hidden`}
			>
				<h2
					className={`px-2.5 pb-2 pt-2.5 text-sm font-semibold grow ${t.heading}`}
				>
					Locations
				</h2>
				<div className="flex items-center transition-all duration-200">
					<div className="grow">
						<input
							ref={inputRef}
							type="text"
							aria-label="Search locations"
							value={searchQuery}
							onChange={handleSearchChange}
							onKeyDown={handleKeyDown}
							placeholder="Search locations..."
							className={`outline-none text-xs px-1 py-1 mt-0.5 transition-all border-b! border-white/20 duration-200 w-full bg-transparent ${t.text} ${searchOpen ? "opacity-100" : "opacity-0 px-0"}`}
						/>
					</div>
					<button
						type="button"
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
			<div className="overflow-y-auto scroll-container flex-1 p-1 pt-0.5">
				{filteredLocations.map(({ name, totalPopulation, bounds }: { name: string; totalPopulation: number; bounds: LocationBounds }) => (
					<button
						type="button"
						key={name}
						onClick={() => onLocationClick(name, bounds)}
						className={`w-full text-left px-2 py-1 rounded transition-all duration-200 text-xs cursor-pointer flex justify-between items-center ${
							selectedLocation === name
								? isDark
									? "bg-white/15 text-gray-100"
									: "bg-white/60 text-gray-800"
								: isDark
									? "hover:bg-white/10 text-gray-400 hover:text-gray-200"
									: "hover:bg-white/40 text-gray-600 hover:text-gray-800"
						}`}
					>
						<span className="font-normal truncate mr-2">
							{name}
						</span>
						<span
							className={`text-xs tabular-nums shrink-0 ${t.textMuted}`}
						>
							{totalPopulation.toLocaleString()}
						</span>
					</button>
				))}
			</div>
			</div>
		</div>
	);
}
