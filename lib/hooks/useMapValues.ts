import { useEffect, useState } from "react";
import type { MapValues } from "@uk-data-atlas/map-tiles/mapValues";
import {
	fetchMapValues,
	mapValuesRequestKey,
	type MapValuesRequest,
} from "../data/mapValues/mapValues";

export type MapValuesState =
	/** Nothing to load: the dataset is joined onto the features. */
	| { status: "none" }
	| { status: "pending" }
	/** The build has no array for it, or it could not be read. Join instead. */
	| { status: "unavailable" }
	| { status: "ready"; values: MapValues };

type Loaded = { key: string; result: MapValues | null };

/**
 * Loads the code-aligned array for a request. A read that fails, including an
 * array made for another code list, is logged and answered as unavailable, so
 * the map is drawn from the join and never from values that may not line up.
 */
export function useMapValues(request: MapValuesRequest | null): MapValuesState {
	const [loaded, setLoaded] = useState<Loaded | null>(null);
	const key = request ? mapValuesRequestKey(request) : null;
	const codeList = request?.codeList;

	useEffect(() => {
		if (!request || !key) return;
		let active = true;
		fetchMapValues(request)
			.then((result) => active && setLoaded({ key, result }))
			.catch((reason: unknown) => {
				console.error(
					`[map-values] ${reason instanceof Error ? reason.message : String(reason)}`,
				);
				if (active) setLoaded({ key, result: null });
			});
		return () => {
			active = false;
		};
		// The request is described by its key and the code list it is read against.
	}, [key, codeList]);

	if (!request || !key) return { status: "none" };
	if (loaded?.key !== key) return { status: "pending" };
	return loaded.result
		? { status: "ready", values: loaded.result }
		: { status: "unavailable" };
}
