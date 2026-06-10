"use client";

import { createContext, use } from "react";

interface ExcludedCategories {
	excludedGeneralParties: Set<string>;
	excludedLocalParties: Set<string>;
	excludedEthnicities: Set<string>;
}

const defaultValue: ExcludedCategories = {
	excludedGeneralParties: new Set(),
	excludedLocalParties: new Set(),
	excludedEthnicities: new Set(),
};

export const ExcludedCategoriesContext =
	createContext<ExcludedCategories>(defaultValue);

export function useExcludedCategories(): ExcludedCategories {
	return use(ExcludedCategoriesContext);
}
