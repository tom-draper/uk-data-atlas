"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ActiveViz } from "@/lib/types";
import type { MapOptions } from "@/lib/types/mapOptions";
import { atlasHeading, atlasHref, atlasInitialState } from "@/lib/atlas/pages";
import {
	mapOptionsFromSearchParams,
	writeMapOptions,
} from "@/lib/helpers/mapOptionsUrl";
import { pageTitle } from "@/lib/site";

export type AtlasUrlState = {
	activeViz: ActiveViz;
	selectedLocation: string;
	mapOptions: MapOptions;
	setActiveViz: (viz: ActiveViz) => void;
	setSelectedLocation: (location: string) => void;
	setMapOptions: (
		type: keyof MapOptions,
		options: Partial<MapOptions[keyof MapOptions]>,
	) => void;
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
	const [mapOptions, setMapOptionsState] = useState(() =>
		mapOptionsFromSearchParams(searchParams),
	);
	const activeVizRef = useRef(activeViz);
	const selectedLocationRef = useRef(selectedLocation);
	const mapOptionsRef = useRef(mapOptions);

	useEffect(() => {
		activeVizRef.current = activeViz;
		selectedLocationRef.current = selectedLocation;
		mapOptionsRef.current = mapOptions;
	});

	const updateUrl = (
		location: string,
		viz: ActiveViz,
		options: MapOptions,
	) => {
		const url = new URL(atlasHref(location, viz), window.location.origin);
		writeMapOptions(url.searchParams, options);
		window.history.replaceState(null, "", `${url.pathname}${url.search}`);
	};

	const setActiveViz = (viz: ActiveViz) => {
		activeVizRef.current = viz;
		setActiveVizState(viz);
		updateUrl(selectedLocationRef.current, viz, mapOptionsRef.current);
	};

	const setSelectedLocation = (location: string) => {
		selectedLocationRef.current = location;
		setSelectedLocationState(location);
		updateUrl(location, activeVizRef.current, mapOptionsRef.current);
	};

	const setMapOptions = (
		type: keyof MapOptions,
		options: Partial<MapOptions[keyof MapOptions]>,
	) => {
		const previous = mapOptionsRef.current;
		const next = {
			...previous,
			[type]: { ...previous[type], ...options },
		} as MapOptions;
		mapOptionsRef.current = next;
		setMapOptionsState(next);
		updateUrl(selectedLocationRef.current, activeVizRef.current, next);
	};

	useEffect(() => {
		const url = new URL(
			atlasHref(selectedLocation, activeViz),
			window.location.origin,
		);
		writeMapOptions(url.searchParams, mapOptions);
		const href = `${url.pathname}${url.search}`;
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
		mapOptions,
		setActiveViz,
		setSelectedLocation,
		setMapOptions,
	};
}
