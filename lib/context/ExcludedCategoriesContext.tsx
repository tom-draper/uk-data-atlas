"use client";

import { createContext, use } from "react";

interface ExcludedCategories {
	excludedGeneralParties: Set<string>;
	selectedGeneralParty?: string;
	excludedLocalParties: Set<string>;
	selectedLocalParty?: string;
	excludedEthnicities: Set<string>;
	selectedEthnicity?: string;
	excludedPointValues: Set<number>;
	selectedPointValue?: number;
}

const defaultValue: ExcludedCategories = {
	excludedGeneralParties: new Set(),
	selectedGeneralParty: undefined,
	excludedLocalParties: new Set(),
	selectedLocalParty: undefined,
	excludedEthnicities: new Set(),
	selectedEthnicity: undefined,
	excludedPointValues: new Set(),
	selectedPointValue: undefined,
};

export const ExcludedCategoriesContext =
	createContext<ExcludedCategories>(defaultValue);

export function useExcludedCategories(): ExcludedCategories {
	return use(ExcludedCategoriesContext);
}
