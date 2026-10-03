"use client";
import { createContext, use } from "react";

/** What the atlas is showing, e.g. "Population Density in London". */
const AtlasHeadingContext = createContext<string | null>(null);

export const AtlasHeadingProvider = AtlasHeadingContext.Provider;

export function useAtlasHeading() {
	return use(AtlasHeadingContext);
}
