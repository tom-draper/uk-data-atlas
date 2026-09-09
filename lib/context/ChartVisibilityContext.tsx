"use client";
import { createContext, use, useSyncExternalStore } from "react";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";
import { getChartDefinitions } from "@/lib/datasets/types";

export type ChartKey = string;

export interface ChartConfigEntry {
	group: string;
	key: ChartKey;
	label: string;
	source: string;
}

export const CHART_CONFIG: ChartConfigEntry[] = [
	...CHART_DATASET_DEFINITIONS.flatMap((definition) =>
		getChartDefinitions(definition).map(({ group, key, label }) => ({
			group,
			key,
			label,
			source: definition.source.source,
		})),
	),
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

let hasReadStoredVisibility = false;
let cachedVisibility: Record<ChartKey, boolean> = DEFAULT_VISIBILITY;
const visibilityListeners = new Set<() => void>();
let isListeningForStorage = false;

const parseVisibility = (raw: string | null): Record<ChartKey, boolean> => {
	if (!raw) return DEFAULT_VISIBILITY;
	try {
		const parsed = JSON.parse(raw) as Partial<Record<ChartKey, boolean>>;
		const persisted: Record<ChartKey, boolean> = {};
		for (const [key, value] of Object.entries(parsed)) {
			if (typeof value === "boolean") persisted[key] = value;
		}
		return { ...DEFAULT_VISIBILITY, ...persisted };
	} catch {
		return DEFAULT_VISIBILITY;
	}
};

const notifyVisibilityListeners = () => {
	for (const listener of visibilityListeners) listener();
};

const handleStorage = (event: StorageEvent) => {
	// A null key means localStorage.clear(), which also resets this preference.
	if (event.key !== null && event.key !== STORAGE_KEY) return;
	hasReadStoredVisibility = true;
	cachedVisibility = parseVisibility(
		event.key === null ? null : event.newValue,
	);
	notifyVisibilityListeners();
};

export function getVisibilitySnapshot(): Record<ChartKey, boolean> {
	if (hasReadStoredVisibility) return cachedVisibility;
	hasReadStoredVisibility = true;
	try {
		cachedVisibility = parseVisibility(localStorage.getItem(STORAGE_KEY));
	} catch {
		// Privacy settings can make localStorage unavailable. Visibility still
		// works for this session, using the defaults as its initial value.
		cachedVisibility = DEFAULT_VISIBILITY;
	}
	return cachedVisibility;
}

export function subscribeVisibility(callback: () => void): () => void {
	visibilityListeners.add(callback);
	if (!isListeningForStorage) {
		window.addEventListener("storage", handleStorage);
		isListeningForStorage = true;
	}
	return () => {
		visibilityListeners.delete(callback);
		if (visibilityListeners.size === 0 && isListeningForStorage) {
			window.removeEventListener("storage", handleStorage);
			isListeningForStorage = false;
		}
	};
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
		cachedVisibility = next;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
		} catch {}
		notifyVisibilityListeners();
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
