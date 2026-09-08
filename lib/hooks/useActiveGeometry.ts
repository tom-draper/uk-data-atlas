"use client";
import { useEffect, useState } from "react";
import type { BoundaryGeojson } from "@lib/types";
import {
	BOUNDARY_CATALOG,
	type BoundaryType,
	fetchBoundaryFile,
} from "../data/boundaries/boundaries";
import {
	constituencyReleaseIdForYear,
	type ConstituencyLadOverlaps,
} from "../data/boundaries/constituencyLadOverlaps";
import type { Crosswalk } from "../data/gazetteer/types";

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
 * The coordinates of the one vintage being drawn.
 *
 * Everything else works from the properties sidecars, which carry no geometry,
 * so the map fetches what it needs here instead of the whole catalogue being
 * held decoded. The file itself is cached — by the browser, and by a small
 * most-recently-used cache of decoded geometry — so moving back to a year just
 * visited does not pay for it again.
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
		fetchBoundaryFile(path, {
			type,
			location: location ?? null,
			getLadForWard,
			constituencyLadOverlaps: constituencyOverlaps,
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
