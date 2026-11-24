"use client";

import { useMemo } from "react";
import { fetchMeasureValues, type MeasureQueryError } from "./client";
import { loadMeasureValues } from "./cache";
import { measureValuesUrl } from "./request";
import type { MeasureValuesPayload, MeasureValuesRequest } from "./types";
import { useAreaFilter } from "./useAreaFilter";
import { useLoaded } from "./useLoaded";

export type MeasureValuesState =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "ready"; data: MeasureValuesPayload }
	| { status: "error"; error: MeasureQueryError | Error };

/**
 * The values of a measure. Every area of the source is read once and shared
 * through `loadMeasureValues`, then cut down to `request.areas` here, so a
 * new set of areas reads nothing. A request that combines areas is sent as
 * it is. Pass null to read nothing.
 */
export function useMeasureValues(
	request: MeasureValuesRequest | null,
): MeasureValuesState {
	const combined = Boolean(request?.parents);
	const { areas, ...whole } = request ?? { measure: "" };
	const sent = combined ? request : request ? whole : null;
	const loaded = useLoaded(
		sent && {
			key: measureValuesUrl(sent),
			load: () =>
				combined ? fetchMeasureValues(sent) : loadMeasureValues(sent),
		},
	);
	const filter = useAreaFilter(combined ? undefined : areas);
	return useMemo(() => {
		if (loaded.status !== "ready") return loaded;
		return {
			status: "ready",
			data: filter ? filter(loaded.value) : loaded.value,
		};
	}, [loaded, filter]);
}
