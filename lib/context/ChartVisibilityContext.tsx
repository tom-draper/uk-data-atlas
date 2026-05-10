"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";

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
	| "brexit-hanretty"
	| "brexit-constituency"
	| "demographics-populationDensity"
	| "demographics-age"
	| "demographics-gender"
	| "demographics-ethnicity"
	| "economics-housePrice"
	| "economics-income"
	| "society-crime"
	| "society-imd"
	| "society-lifeExpectancy"
	| "society-healthyLifeExpectancy";

export interface ChartConfigEntry {
	group: string;
	key: ChartKey;
	label: string;
}

export const CHART_CONFIG: ChartConfigEntry[] = [
	{ group: "General Election", key: "generalElection-2024", label: "2024 General Election" },
	{ group: "General Election", key: "generalElection-2019", label: "2019 General Election" },
	{ group: "General Election", key: "generalElection-2017", label: "2017 General Election" },
	{ group: "General Election", key: "generalElection-2015", label: "2015 General Election" },
	{ group: "Local Election", key: "localElection-2025", label: "2025 Local Elections" },
	{ group: "Local Election", key: "localElection-2024", label: "2024 Local Elections" },
	{ group: "Local Election", key: "localElection-2023", label: "2023 Local Elections" },
	{ group: "Local Election", key: "localElection-2022", label: "2022 Local Elections" },
	{ group: "Local Election", key: "localElection-2021", label: "2021 Local Elections" },
	{ group: "Brexit", key: "brexit-constituency", label: "Commission [2016]" },
	{ group: "Brexit", key: "brexit-hanretty", label: "Hanretty Estimates [2016]" },
	{ group: "Demographics", key: "demographics-populationDensity", label: "Population Density [2022]" },
	{ group: "Demographics", key: "demographics-age", label: "Age Distribution [2022]" },
	{ group: "Demographics", key: "demographics-gender", label: "Gender Balance [2022]" },
	{ group: "Demographics", key: "demographics-ethnicity", label: "Ethnicity [2022]" },
	{ group: "Economics", key: "economics-housePrice", label: "House Prices [2023]" },
	{ group: "Economics", key: "economics-income", label: "Income [2025]" },
	{ group: "Society", key: "society-crime", label: "Crime Rate [2025]" },
	{ group: "Society", key: "society-imd", label: "Deprivation (IMD) [2019]" },
	{ group: "Society", key: "society-lifeExpectancy", label: "Life Expectancy [2020-2022]" },
	{ group: "Society", key: "society-healthyLifeExpectancy", label: "Healthy Life Expectancy [2020-2022]" },
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
	"brexit-constituency": true,
	"demographics-populationDensity": true,
	"demographics-age": true,
	"demographics-gender": true,
	"demographics-ethnicity": true,
	"economics-housePrice": true,
	"economics-income": true,
	"society-crime": true,
	"society-imd": true,
	"society-lifeExpectancy": true,
	"society-healthyLifeExpectancy": false,
};

const STORAGE_KEY = "uk-data-atlas-chart-visibility";

interface ChartVisibilityContextValue {
	visibility: Record<ChartKey, boolean>;
	toggle: (key: ChartKey) => void;
}

const ChartVisibilityContext = createContext<ChartVisibilityContextValue>({
	visibility: DEFAULT_VISIBILITY,
	toggle: () => {},
});

export function ChartVisibilityProvider({ children }: { children: React.ReactNode }) {
	const [visibility, setVisibility] = useState<Record<ChartKey, boolean>>(DEFAULT_VISIBILITY);

	useEffect(() => {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored) as Partial<Record<ChartKey, boolean>>;
				setVisibility({ ...DEFAULT_VISIBILITY, ...parsed });
			}
		} catch {
			localStorage.removeItem(STORAGE_KEY);
		}
	}, []);

	const toggle = useCallback((key: ChartKey) => {
		setVisibility((prev) => {
			const next = { ...prev, [key]: !prev[key] };
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
			} catch {
				// ignore
			}
			return next;
		});
	}, []);

	return (
		<ChartVisibilityContext.Provider value={{ visibility, toggle }}>
			{children}
		</ChartVisibilityContext.Provider>
	);
}

export function useChartVisibility() {
	return useContext(ChartVisibilityContext);
}
