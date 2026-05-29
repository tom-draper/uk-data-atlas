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
	| "society-crime"
	| "society-imd"
	| "society-simd"
	| "society-wimd"
	| "society-nimdm"
	| "society-lifeExpectancy"
	| "society-healthyLifeExpectancy"
	| "education-qualifications";

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
		label: "Elecotral Commission [2016]",
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
	{ group: "Society", key: "society-crime", label: "Crime Rate [2025]" },
	{ group: "Society", key: "society-imd", label: "Deprivation (IMD) [2019]" },
	{
		group: "Society",
		key: "society-simd",
		label: "Deprivation (SIMD) [2020]",
	},
	{
		group: "Society",
		key: "society-wimd",
		label: "Deprivation (WIMD) [2019]",
	},
	{
		group: "Society",
		key: "society-nimdm",
		label: "Deprivation (NIMDM) [2017]",
	},
	{
		group: "Society",
		key: "society-lifeExpectancy",
		label: "Life Expectancy [2020-2022]",
	},
	{
		group: "Society",
		key: "society-healthyLifeExpectancy",
		label: "Healthy Life Expectancy [2020-2022]",
	},
	{
		group: "Education",
		key: "education-qualifications",
		label: "Qualifications [2021]",
	},
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
	"society-crime": true,
	"society-imd": true,
	"society-simd": false,
	"society-wimd": false,
	"society-nimdm": false,
	"society-lifeExpectancy": true,
	"society-healthyLifeExpectancy": false,
	"education-qualifications": true,
};

const STORAGE_KEY = "uk-data-atlas-chart-visibility";

let _cachedStorageKey: string | null | undefined = undefined;
let _cachedVisibility: Record<ChartKey, boolean> = DEFAULT_VISIBILITY;

function getSnapshot(): Record<ChartKey, boolean> {
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

function subscribe(callback: () => void): () => void {
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
		subscribe,
		getSnapshot,
		() => DEFAULT_VISIBILITY,
	);

	const toggle = (key: ChartKey) => {
		const current = getSnapshot();
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
