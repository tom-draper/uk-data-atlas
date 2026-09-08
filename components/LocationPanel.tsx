import { useIsDark } from "@/lib/context/ThemeContext";
import { panelTheme, glassStyle } from "@/lib/helpers/panelTheme";
import GlassOverlays from "./GlassOverlays";
import { gazetteer } from "@lib/data/gazetteer/static";
import { LocationBounds, PopulationDataset } from "@lib/types";

// Named locations sourced from the gazetteer (built once). Shaped as the old
// LocationBounds record so downstream list/handlers are unchanged.
const NAMED_LOCATIONS: Record<string, LocationBounds> = Object.fromEntries(
	gazetteer.namedLocations().map((name) => {
		const nl = gazetteer.namedLocation(name)!;
		return [name, { lad_codes: nl.memberCodes, bounds: nl.bbox }];
	}),
);
import {
	useState,
	useTransition,
	useDeferredValue,
	useRef,
	useMemo,
} from "react";

interface LocationPanelProps {
	selectedLocation: string | null;
	onLocationClick: (location: string, bounds: LocationBounds) => void;
	/**
	 * Absent whenever no population chart is enabled, because the dataset is
	 * fetched per chart. The panel is not a chart, so it has to cope: without
	 * it the locations carry no population and the list comes out empty.
	 */
	populationDataset: PopulationDataset | undefined;
}

export default function LocationPanel({
	selectedLocation,
	onLocationClick,
	populationDataset,
}: LocationPanelProps) {
	const [searchOpen, setSearchOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [, startTransition] = useTransition();
	const inputRef = useRef<HTMLInputElement>(null);

	const deferredSearchQuery = useDeferredValue(searchQuery);

	const allLocations = useMemo(() => {
		return Object.entries(NAMED_LOCATIONS)
			.flatMap(([location, bounds]) => {
				const totalPopulation =
					populationDataset?.locationPopulations?.[location] || 0;
				if (totalPopulation <= 0) return [];
				return [{ name: location, totalPopulation, bounds }];
			})
			.sort((a, b) => b.totalPopulation - a.totalPopulation);
	}, [populationDataset?.locationPopulations]);

	const filteredLocations = useMemo(() => {
		if (!deferredSearchQuery.trim()) return allLocations;

		const query = deferredSearchQuery.toLowerCase();
		return allLocations.filter(({ name }: { name: string }) =>
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
		<div
			className={`rounded-md flex flex-col h-full relative overflow-hidden ${isDark ? "text-gray-100" : "text-gray-800"}`}
			style={glassStyle(isDark)}
		>
			<GlassOverlays isDark={isDark} />
			{/* Content sits above overlays */}
			<div
				className="relative flex flex-col h-full"
				style={{ zIndex: 1 }}
			>
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
					{filteredLocations.map(
						({
							name,
							totalPopulation,
							bounds,
						}: {
							name: string;
							totalPopulation: number;
							bounds: LocationBounds;
						}) => (
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
						),
					)}
				</div>
			</div>
		</div>
	);
}
