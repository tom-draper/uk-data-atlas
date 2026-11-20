"use client";

import { useMemo } from "react";
import { fetchMeasureValues, type MeasureQueryError } from "./client";
import { loadMeasureValues, restrictToAreas } from "./cache";
import { measureValuesUrl } from "./request";
import type { MeasureValuesPayload, MeasureValuesRequest } from "./types";
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
	const key = sent ? measureValuesUrl(sent) : null;
	const loaded = useLoaded(key, () =>
		combined ? fetchMeasureValues(sent!) : loadMeasureValues(sent!),
	);
	const areasKey = !combined && areas ? areas.join(",") : null;
	const data = loaded.status === "ready" ? loaded.value : null;
	const restricted = useMemo(
		() =>
			data && areasKey !== null ? restrictToAreas(data, areas!) : data,
		// The areas are named by their key.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[data, areasKey],
	);
	if (loaded.status !== "ready") return loaded;
	return { status: "ready", data: restricted! };
}
