"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ActiveViz } from "@/lib/types";
import {
	atlasHeading,
	atlasHref,
	atlasInitialState,
	pageTitle,
} from "@/lib/atlas/pages";

export type AtlasUrlState = {
	activeViz: ActiveViz;
	selectedLocation: string;
	setActiveViz: (viz: ActiveViz) => void;
	setSelectedLocation: (location: string) => void;
};

/** The page the atlas opened on, as the slugs in its path. */
export type AtlasPage = { location?: string; map?: string };

/** Keep the atlas selection and its shareable URL in sync. */
export function useAtlasUrlState(page: AtlasPage): AtlasUrlState {
	const searchParams = useSearchParams();
	const initialState = atlasInitialState(page, searchParams.get("period"));
	const [activeViz, setActiveVizState] = useState(initialState.activeViz);
	const [selectedLocation, setSelectedLocationState] = useState(
		initialState.selectedLocation,
	);
	const activeVizRef = useRef(activeViz);
	const selectedLocationRef = useRef(selectedLocation);

	useEffect(() => {
		activeVizRef.current = activeViz;
		selectedLocationRef.current = selectedLocation;
	});

	const updateUrl = (location: string, viz: ActiveViz) => {
		window.history.replaceState(null, "", atlasHref(location, viz));
	};

	const setActiveViz = (viz: ActiveViz) => {
		setActiveVizState(viz);
		updateUrl(selectedLocationRef.current, viz);
	};

	const setSelectedLocation = (location: string) => {
		setSelectedLocationState(location);
		updateUrl(location, activeVizRef.current);
	};

	useEffect(() => {
		const href = atlasHref(selectedLocation, activeViz);
		if (window.location.pathname + window.location.search !== href)
			window.history.replaceState(null, "", href);
		// Only run on mount.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		document.title = pageTitle(atlasHeading(selectedLocation, activeViz));
	}, [selectedLocation, activeViz]);

	return {
		activeViz,
		selectedLocation,
		setActiveViz,
		setSelectedLocation,
	};
}
