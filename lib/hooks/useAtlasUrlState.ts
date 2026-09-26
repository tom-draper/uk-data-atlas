"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ActiveViz } from "@/lib/types";
import {
	activeVizFromReference,
	parseVisualizationRef,
	writeVisualizationRef,
} from "@/lib/helpers/visualization";

export const DEFAULT_ACTIVE_VIZ: ActiveViz = {
	datasetId: "localElection2024",
	datasetType: "localElection",
	datasetYear: 2024,
};

export const DEFAULT_LOCATION = "Greater Manchester";

export type AtlasUrlState = {
	activeViz: ActiveViz;
	selectedLocation: string;
	setActiveViz: (viz: ActiveViz) => void;
	setSelectedLocation: (location: string) => void;
};

export function atlasStateFromParams(params: URLSearchParams): {
	activeViz: ActiveViz;
	selectedLocation: string;
} {
	const reference = parseVisualizationRef(params);
	return {
		activeViz: reference
			? (activeVizFromReference(reference) ?? DEFAULT_ACTIVE_VIZ)
			: DEFAULT_ACTIVE_VIZ,
		selectedLocation: params.get("location") ?? DEFAULT_LOCATION,
	};
}

function writeAtlasStateParams(
	location: string,
	viz: ActiveViz,
): URLSearchParams {
	const params = new URLSearchParams();
	params.set("location", location);
	writeVisualizationRef(params, viz);
	return params;
}

/** Keep the atlas selection and its shareable URL in sync. */
export function useAtlasUrlState(): AtlasUrlState {
	const searchParams = useSearchParams();
	const initialState = atlasStateFromParams(searchParams);
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

	const updateParams = (location: string, viz: ActiveViz) => {
		const params = writeAtlasStateParams(location, viz);
		window.history.replaceState(null, "", `?${params.toString()}`);
	};

	const setActiveViz = (viz: ActiveViz) => {
		setActiveVizState(viz);
		updateParams(selectedLocationRef.current, viz);
	};

	const setSelectedLocation = (location: string) => {
		setSelectedLocationState(location);
		updateParams(location, activeVizRef.current);
	};

	useEffect(() => {
		const params = writeAtlasStateParams(selectedLocation, activeViz);
		const canonicalSearch = `?${params.toString()}`;
		if (window.location.search !== canonicalSearch)
			window.history.replaceState(null, "", canonicalSearch);
		// Only run on mount.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		document.title = selectedLocation
			? `${selectedLocation} - UK Data Atlas`
			: "UK Data Atlas";
	}, [selectedLocation]);

	return {
		activeViz,
		selectedLocation,
		setActiveViz,
		setSelectedLocation,
	};
}
