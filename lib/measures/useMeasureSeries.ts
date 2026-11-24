"use client";

import { useMemo } from "react";
import { loadMeasureHistory } from "./history";
import { ALL_PERIODS, measureValuesUrl } from "./request";
import type { MeasureValuesRequest } from "./types";
import { useAreaFilter } from "./useAreaFilter";
import { useLoaded } from "./useLoaded";
import type { MeasureValuesState } from "./useMeasureValues";

/**
 * A measure's values in every period its source publishes, however many,
 * cut down to `request.areas`. `request` must not name periods. Pass null to
 * read nothing.
 */
export function useMeasureSeries(
	request: Omit<MeasureValuesRequest, "periods" | "parents"> | null,
): MeasureValuesState {
	const { areas, ...whole } = request ?? { measure: "" };
	const loaded = useLoaded(
		request && {
			key: measureValuesUrl({ ...whole, periods: [ALL_PERIODS] }),
			load: () => loadMeasureHistory(whole),
		},
	);
	const filter = useAreaFilter(areas);
	return useMemo(() => {
		if (loaded.status !== "ready") return loaded;
		return {
			status: "ready",
			data: filter ? filter(loaded.value) : loaded.value,
		};
	}, [loaded, filter]);
}
