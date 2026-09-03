"use client";
import { createContext, use, useSyncExternalStore } from "react";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";
import { getChartDefinitions } from "@/lib/datasets/types";

export type ChartKey = string;

export interface ChartConfigEntry {
	group: string;
	key: ChartKey;
	label: string;
}

export const CHART_CONFIG: ChartConfigEntry[] = [
	...CHART_DATASET_DEFINITIONS.flatMap(getChartDefinitions),
];

export const DEFAULT_VISIBILITY: Record<ChartKey, boolean> = {
	...Object.fromEntries(
		CHART_DATASET_DEFINITIONS.flatMap((definition) =>
			getChartDefinitions(definition).map((chart) => [
				chart.key,
				chart.defaultVisible,
			]),
		),
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
