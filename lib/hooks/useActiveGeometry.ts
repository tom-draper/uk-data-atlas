"use client";
import { useEffect, useState } from "react";
import type { BoundaryGeojson } from "@lib/types";
import {
	BOUNDARY_CATALOG,
	type BoundaryType,
	fetchBoundaryFile,
	filterFeatures,
} from "../data/boundaries/boundaries";

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
): {
	geometry: BoundaryGeojson | null;
	isLoading: boolean;
	error: Error | null;
} {
	const [state, setState] = useState<{
		geometry: BoundaryGeojson | null;
		isLoading: boolean;
		error: Error | null;
	}>({ geometry: null, isLoading: false, error: null });

	const path =
		type && year !== undefined
			? (BOUNDARY_CATALOG[type].vintages[year] ?? null)
			: null;

	useEffect(() => {
		if (!path || !type) {
			setState({ geometry: null, isLoading: false, error: null });
			return;
		}

		let active = true;
		setState((previous) => ({ ...previous, isLoading: true, error: null }));
		fetchBoundaryFile(path)
			.then((data) => {
				if (!active) return;
				setState({
					geometry: filterFeatures(
						data,
						location ?? null,
						type,
						getLadForWard,
					),
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
				setState({ geometry: null, isLoading: false, error });
			});

		return () => {
			active = false;
		};
	}, [path, type, location, getLadForWard]);

	return state;
}
