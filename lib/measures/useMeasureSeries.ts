"use client";

import { MAX_PERIODS } from "./request";
import type { MeasureValuesRequest } from "./types";
import { useMeasureValues, type MeasureValuesState } from "./useMeasureValues";

/** The periods to read for a measure's whole history, newest MAX_PERIODS. */
export const historyPeriods = (periods: readonly string[]): string[] =>
	periods.slice(-MAX_PERIODS);

/**
 * A measure's values in every period it has. The route answers with the
 * latest period unless told which to read, so this asks once for the latest,
 * which names the periods the source holds, then again for all of them.
 * `request` must not name periods. Pass null to read nothing.
 */
export function useMeasureSeries(
	request: Omit<MeasureValuesRequest, "periods"> | null,
): MeasureValuesState {
	const latest = useMeasureValues(request);
	const periods =
		latest.status === "ready"
			? historyPeriods(latest.data.source.periods)
			: [];
	const history = useMeasureValues(
		request && periods.length > 1 ? { ...request, periods } : null,
	);
	if (latest.status !== "ready") return latest;
	// With one period there is no series to draw, so the latest answer stands.
	return periods.length > 1 ? history : latest;
}
