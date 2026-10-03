"use client";
import { createContext, use } from "react";

/** What the atlas is showing, and the page listing the place's other maps. */
export type AtlasHeading = {
	/** e.g. "Population Density in London". */
	text: string;
	/** e.g. "/maps/london", when the place has a browse page. */
	mapsHref: string | null;
};

const AtlasHeadingContext = createContext<AtlasHeading | null>(null);

export const AtlasHeadingProvider = AtlasHeadingContext.Provider;

export function useAtlasHeading() {
	return use(AtlasHeadingContext);
}
