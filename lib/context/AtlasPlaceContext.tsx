"use client";
import { createContext, use } from "react";

/** The page listing every map of the atlas's place, e.g. "/maps/london". */
const PlaceMapsHrefContext = createContext<string | null>(null);

export const PlaceMapsHrefProvider = PlaceMapsHrefContext.Provider;

export function usePlaceMapsHref() {
	return use(PlaceMapsHrefContext);
}
