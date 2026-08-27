"use client";
import { createContext, use, useSyncExternalStore } from "react";

export type ChartKey =
	| "generalElection-2024"
	| "generalElection-2019"
	| "generalElection-2017"
	| "generalElection-2015"
	| "localElection-2025"
	| "localElection-2024"
	| "localElection-2023"
	| "localElection-2022"
	| "localElection-2021"
	| "brexit-electoral"
	| "brexit-hanretty"
	| "demographics-populationDensity"
	| "demographics-age"
	| "demographics-gender"
	| "demographics-ethnicity"
	| "economics-housePrice"
	| "economics-income"
	| "economics-crime"
	| "deprivation-imd"
	| "deprivation-simd"
	| "deprivation-wimd"
	| "deprivation-nimdm"
	| "health-lifeExpectancy"
	| "health-healthyLifeExpectancy"
	| "education-qualifications"
	| "telecoms-broadband"
	| "environment-airQuality"
	| "economics-claimantCount"
	| "education-schoolPerformance"
	| "health-nhsWaiting"
	| "economics-unemployment"
	| "economics-childPoverty"
	| "economics-homelessness";

export interface ChartConfigEntry {
	group: string;
	key: ChartKey;
	label: string;
}

export const CHART_CONFIG: ChartConfigEntry[] = [
	{
		group: "General Election",
		key: "generalElection-2024",
		label: "2024 General Election",
	},
	{
		group: "General Election",
		key: "generalElection-2019",
		label: "2019 General Election",
	},
	{
		group: "General Election",
		key: "generalElection-2017",
		label: "2017 General Election",
	},
	{
		group: "General Election",
		key: "generalElection-2015",
		label: "2015 General Election",
	},
	{
		group: "Local Election",
		key: "localElection-2025",
		label: "2025 Local Elections",
	},
	{
		group: "Local Election",
		key: "localElection-2024",
		label: "2024 Local Elections",
	},
	{
		group: "Local Election",
		key: "localElection-2023",
		label: "2023 Local Elections",
	},
	{
		group: "Local Election",
		key: "localElection-2022",
		label: "2022 Local Elections",
	},
	{
		group: "Local Election",
		key: "localElection-2021",
		label: "2021 Local Elections",
	},
	{
		group: "Brexit",
		key: "brexit-electoral",
		label: "Electoral Commission [2016]",
	},
	{
		group: "Brexit",
		key: "brexit-hanretty",
		label: "Hanretty Estimates [2016]",
	},
	{
		group: "Demographics",
		key: "demographics-populationDensity",
		label: "Population Density [2022]",
	},
	{
		group: "Demographics",
		key: "demographics-age",
		label: "Age Distribution [2022]",
	},
	{
		group: "Demographics",
		key: "demographics-gender",
		label: "Gender Balance [2022]",
	},
	{
		group: "Demographics",
		key: "demographics-ethnicity",
		label: "Ethnicity [2022]",
	},
	{
		group: "Economics",
		key: "economics-housePrice",
		label: "House Prices [2023]",
	},
	{ group: "Economics", key: "economics-income", label: "Income [2025]" },
	{ group: "Economics", key: "economics-crime", label: "Crime Rate [2025]" },
	{ group: "Deprivation", key: "deprivation-imd", label: "Deprivation (IMD) [2019]" },
	{ group: "Deprivation", key: "deprivation-simd", label: "Deprivation (SIMD) [2020]" },
	{ group: "Deprivation", key: "deprivation-wimd", label: "Deprivation (WIMD) [2019]" },
	{ group: "Deprivation", key: "deprivation-nimdm", label: "Deprivation (NIMDM) [2017]" },
	{ group: "Health", key: "health-lifeExpectancy", label: "Life Expectancy [2020-2022]" },
	{ group: "Health", key: "health-healthyLifeExpectancy", label: "Healthy Life Expectancy [2020-2022]" },
	{ group: "Education", key: "education-qualifications", label: "Qualifications [2021]" },
	{ group: "Telecoms", key: "telecoms-broadband", label: "Fixed Broadband Coverage [2025]" },
	{ group: "Environment", key: "environment-airQuality", label: "Air Quality - NO2 [2022]" },
	{ group: "Economics", key: "economics-claimantCount", label: "Claimant Count [2026]" },
	{ group: "Education", key: "education-schoolPerformance", label: "School Performance [2024]" },
	{ group: "Health", key: "health-nhsWaiting", label: "NHS Waiting Times [Mar 2026]" },
	{ group: "Economics", key: "economics-unemployment", label: "Unemployment Rate [2024]" },
	{ group: "Economics", key: "economics-childPoverty", label: "Child Poverty [2025]" },
	{ group: "Economics", key: "economics-homelessness", label: "Homelessness [2026]" },
];

export const DEFAULT_VISIBILITY: Record<ChartKey, boolean> = {
	"generalElection-2024": true,
	"generalElection-2019": true,
	"generalElection-2017": true,
	"generalElection-2015": true,
	"localElection-2025": true,
	"localElection-2024": true,
	"localElection-2023": true,
	"localElection-2022": true,
	"localElection-2021": true,
	"brexit-hanretty": false,
	"brexit-electoral": true,
	"demographics-populationDensity": true,
	"demographics-age": true,
	"demographics-gender": true,
	"demographics-ethnicity": true,
	"economics-housePrice": true,
	"economics-income": true,
	"economics-crime": true,
	"deprivation-imd": true,
	"deprivation-simd": false,
	"deprivation-wimd": false,
	"deprivation-nimdm": false,
	"health-lifeExpectancy": true,
	"health-healthyLifeExpectancy": false,
	"education-qualifications": true,
	"telecoms-broadband": true,
	"environment-airQuality": true,
	"economics-claimantCount": true,
	"education-schoolPerformance": true,
	"health-nhsWaiting": true,
	"economics-unemployment": true,
	"economics-childPoverty": true,
	"economics-homelessness": true,
};

const STORAGE_KEY = "uk-data-atlas-chart-visibility";

let _cachedStorageKey: string | null | undefined = undefined;
let _cachedVisibility: Record<ChartKey, boolean> = DEFAULT_VISIBILITY;

export function getVisibilitySnapshot(): Record<ChartKey, boolean> {
	const raw = localStorage.getItem(STORAGE_KEY);
	if (raw === _cachedStorageKey) return _cachedVisibility;
	_cachedStorageKey = raw;
	if (!raw) {
		_cachedVisibility = DEFAULT_VISIBILITY;
		return _cachedVisibility;
	}
	try {
		const parsed = JSON.parse(raw) as Partial<Record<ChartKey, boolean>>;
		_cachedVisibility = { ...DEFAULT_VISIBILITY, ...parsed };
	} catch {
		localStorage.removeItem(STORAGE_KEY);
		_cachedStorageKey = null;
		_cachedVisibility = DEFAULT_VISIBILITY;
	}
	return _cachedVisibility;
}

export function subscribeVisibility(callback: () => void): () => void {
	window.addEventListener("storage", callback);
	return () => window.removeEventListener("storage", callback);
}

interface ChartVisibilityContextValue {
	visibility: Record<ChartKey, boolean>;
	toggle: (key: ChartKey) => void;
}

const ChartVisibilityContext = createContext<ChartVisibilityContextValue>({
	visibility: DEFAULT_VISIBILITY,
	toggle: () => {},
});

export function ChartVisibilityProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const visibility = useSyncExternalStore(
		subscribeVisibility,
		getVisibilitySnapshot,
		() => DEFAULT_VISIBILITY,
	);

	const toggle = (key: ChartKey) => {
		const current = getVisibilitySnapshot();
		const next = { ...current, [key]: !current[key] };
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
		} catch {}
		window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
	};

	const ctxValue = { visibility, toggle };
	return (
		<ChartVisibilityContext.Provider value={ctxValue}>
			{children}
		</ChartVisibilityContext.Provider>
	);
}

export function useChartVisibility() {
	return use(ChartVisibilityContext);
}
