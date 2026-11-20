"use client";

import { ALL_PERIODS } from "./request";
import type { MeasureValuesRequest } from "./types";
import { useMeasureValues, type MeasureValuesState } from "./useMeasureValues";

/**
 * A measure's values in every period it has, newest MAX_PERIODS, in one
 * request. `request` must not name periods. Pass null to read nothing.
 */
export function useMeasureSeries(
	request: Omit<MeasureValuesRequest, "periods"> | null,
): MeasureValuesState {
	return useMeasureValues(
		request ? { ...request, periods: [ALL_PERIODS] } : null,
	);
}
