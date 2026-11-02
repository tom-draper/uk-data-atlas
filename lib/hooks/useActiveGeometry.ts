"use client";
import { useEffect, useState } from "react";
import type { BoundaryGeojson } from "@lib/types";
import {
	BOUNDARY_CATALOG,
	type BoundaryType,
} from "../data/boundaries/boundaries";
import {
	constituencyReleaseIdForYear,
	type ConstituencyLadOverlaps,
} from "../data/boundaries/constituencyLadOverlaps";
import { fetchMapBoundaries } from "../data/boundaries/tiles";
import type { Crosswalk } from "@uk-data-atlas/datasets/data/gazetteer/types";

type GeometryState = {
	geometry: BoundaryGeojson | null;
	/** The request which produced `geometry`, rather than one now in flight. */
	requestKey: string | null;
	isLoading: boolean;
	error: Error | null;
};

/** Identifies the complete boundary request, including its location filter. */
export function geometryRequestKey(
	path: string | null,
	type: BoundaryType | undefined,
	location: string | null,
	filterKey = "",
): string | null {
	return path && type
		? `${path}\u0000${type}\u0000${location ?? ""}\u0000${filterKey}`
		: null;
}

/**
 * A completed request may remain in state while another request is in flight.
 * Do not let its geometry be rendered for the new request in that interval.
 */
export function geometryForRequest(
	geometry: BoundaryGeojson | null,
	loadedRequestKey: string | null,
	currentRequestKey: string | null,
): BoundaryGeojson | null {
	return loadedRequestKey === currentRequestKey ? geometry : null;
}

/**
 * Loads the active release's properties and associates its PMTiles resource
 * for dataset rendering and interaction.
 */
export function useActiveGeometry(
	type: BoundaryType | undefined,
	year: number | undefined,
	location: string | null,
	getLadForWard?: (wardCode: string) => string | undefined,
	constituencyLadOverlaps?: ConstituencyLadOverlaps | null,
): {
	geometry: BoundaryGeojson | null;
	isLoading: boolean;
	error: Error | null;
} {
	const [state, setState] = useState<GeometryState>({
		geometry: null,
		requestKey: null,
		isLoading: false,
		error: null,
	});

	const path =
		type && year !== undefined
			? (BOUNDARY_CATALOG[type].vintages[year] ?? null)
			: null;
	const constituencyOverlaps: Crosswalk | undefined =
		type === "constituency" && year !== undefined
			? constituencyLadOverlaps?.releases[
					constituencyReleaseIdForYear(year) ?? ""
				]
			: undefined;
	// The overlap lookup changes the filter's result, so it must be part of the
	// request identity. That prevents the coarse bbox result being drawn while
	// the precise constituency set is applied.
	const requestKey = geometryRequestKey(
		path,
		type,
		location,
		constituencyOverlaps ? "constituency-lad-overlaps" : "bbox",
	);

	useEffect(() => {
		if (!path || !type) {
			setState({
				geometry: null,
				requestKey: null,
				isLoading: false,
				error: null,
			});
			return;
		}

		let active = true;
		setState((previous) => ({ ...previous, isLoading: true, error: null }));
		fetchMapBoundaries(path, {
			type,
			location: location ?? null,
			relations: {
				getLadForWard,
				constituencyLadOverlaps: constituencyOverlaps,
			},
		})
			.then((data) => {
				if (!active) return;
				setState({
					geometry: data,
					requestKey,
					isLoading: false,
					error: null,
				});
			})
			.catch((reason) => {
				if (!active) return;
				const error =
					reason instanceof Error
						? reason
						: new Error(String(reason));
				console.error(`[boundaries] ${error.message}`);
				setState({
					geometry: null,
					requestKey,
					isLoading: false,
					error,
				});
			});

		return () => {
			active = false;
		};
	}, [path, type, location, getLadForWard, constituencyOverlaps, requestKey]);

	return {
		...state,
		geometry: geometryForRequest(
			state.geometry,
			state.requestKey,
			requestKey,
		),
	};
}
