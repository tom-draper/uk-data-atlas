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
	// Joining every code costs real time for a national scope, so it is done
	// once per list rather than on every render.
	const areasKey = useMemo(
		() => (!combined && areas ? areas.join(",") : null),
		[combined, areas],
	);
	const data = loaded.status === "ready" ? loaded.value : null;
	const restricted = useMemo(
		() =>
			data && areasKey !== null ? restrictToAreas(data, areas!) : data,
		// The areas are named by their key.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[data, areasKey],
	);
	// The same object while the data is, so callers' memoised work holds.
	// The React Compiler skips this file, so it is kept by hand.
	const ready = useMemo(
		() => ({ status: "ready" as const, data: restricted! }),
		[restricted],
	);
	if (loaded.status !== "ready") return loaded;
	return ready;
}
