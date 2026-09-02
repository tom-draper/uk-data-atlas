"use client";
import { createContext, use, useSyncExternalStore } from "react";
import { SCALAR_DATASET_DEFINITIONS } from "@/lib/datasets";
import { getChartDefinitions } from "@/lib/datasets/types";

export type ChartKey = string;

type LegacyChartKey =
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
	| "brexit-hanretty";

export interface ChartConfigEntry {
	group: string;
	key: LegacyChartKey | ChartKey;
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
	...SCALAR_DATASET_DEFINITIONS.flatMap(getChartDefinitions),
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
	...Object.fromEntries(
		SCALAR_DATASET_DEFINITIONS.flatMap((definition) => getChartDefinitions(definition).map((chart) => [chart.key, chart.defaultVisible])),
	),
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
		const persisted: Record<ChartKey, boolean> = {};
		for (const [key, value] of Object.entries(parsed)) {
			if (typeof value === "boolean") persisted[key] = value;
		}
		_cachedVisibility = { ...DEFAULT_VISIBILITY, ...persisted };
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
