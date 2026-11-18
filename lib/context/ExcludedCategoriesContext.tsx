"use client";

import { createContext, use } from "react";

interface ExcludedCategories {
	excludedGeneralParties: Set<string>;
	selectedGeneralParty?: string;
	excludedLocalParties: Set<string>;
	selectedLocalParty?: string;
	/** What a visitor has crossed out or isolated in a categorical map's legend, by dataset. */
	categories: Readonly<
		Record<string, { excluded: Set<string>; selected?: string }>
	>;
	excludedPointValues: Set<number>;
	selectedPointValue?: number;
}

const defaultValue: ExcludedCategories = {
	excludedGeneralParties: new Set(),
	selectedGeneralParty: undefined,
	excludedLocalParties: new Set(),
	selectedLocalParty: undefined,
	categories: {},
	excludedPointValues: new Set(),
	selectedPointValue: undefined,
};

export const ExcludedCategoriesContext =
	createContext<ExcludedCategories>(defaultValue);

export function useExcludedCategories(): ExcludedCategories {
	return use(ExcludedCategoriesContext);
}
