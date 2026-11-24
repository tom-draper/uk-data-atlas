"use client";

import type { CodeYearResolver } from "@/lib/data/boundaries/codeMapper";
import { loadMeasureHistory } from "./history";
import { ALL_PERIODS, measureValuesUrl } from "./request";
import type { SeriesPoint } from "./series";
import type { MeasureValuesPayload, MeasureValuesRequest } from "./types";
import { useLoaded, type Loaded } from "./useLoaded";

/**
 * A measure held on the areas of each period's own year keeps the periods
 * before an area's code changed on an earlier boundary release, under the
 * old code. These read them back for one area, so its line runs through
 * the change. An area merged from others has no earlier code: its line
 * starts where the merged area does.
 */

/** Where one area's earlier periods are held: the release and the code it had there. */
export type EarlierArea = { boundaryYear: number; area: string };

/**
 * The code `area` of `boundaryYear` had in each earlier year, where it was
 * the same area under another code, newest first and each code once.
 */
export function earlierAreas(
	area: string,
	geography: string,
	boundaryYear: number,
	years: readonly number[],
	resolver: CodeYearResolver | undefined,
): EarlierArea[] {
	if (!resolver) return [];
	const seen = new Set([area]);
	const earlier: EarlierArea[] = [];
	for (const year of [...years].sort((a, b) => b - a)) {
		const code = resolver.getCodeForYear(
			geography as Parameters<CodeYearResolver["getCodeForYear"]>[0],
			area,
			year,
			boundaryYear,
		);
		if (!code || seen.has(code)) continue;
		seen.add(code);
		earlier.push({ boundaryYear: year, area: code });
	}
	return earlier;
}

/**
 * One line from an area's points and those of its earlier codes. A period
 * the current release holds keeps its value; the others fill the periods
 * before it, in order.
 */
export function withEarlierPeriods(
	points: readonly SeriesPoint[],
	earlier: ReadonlyArray<readonly SeriesPoint[]>,
): SeriesPoint[] {
	const held = new Map(
		points
			.filter((point) => point.value !== null)
			.map((point) => [point.period, point]),
	);
	for (const series of earlier)
		for (const point of series)
			if (point.value !== null && !held.has(point.period))
				held.set(point.period, point);
	const periods = new Set([
		...points.map((point) => point.period),
		...held.keys(),
	]);
	return [...periods]
		.sort()
		.map((period) => held.get(period) ?? { period, value: null });
}

export type EarlierPayload = { area: string; payload: MeasureValuesPayload };

/**
 * Each earlier area's history on its own release. A release that does not
 * publish the measure is left out rather than failing the card.
 */
export function useEarlierSeries(
	request: Omit<MeasureValuesRequest, "periods" | "areas" | "parents">,
	earlier: readonly EarlierArea[],
): Loaded<EarlierPayload[]> {
	const requests = earlier.map(({ boundaryYear, area }) => ({
		area,
		whole: { ...request, boundaryYear },
	}));
	return useLoaded(
		requests.length
			? {
					key: requests
						.map(
							({ area, whole }) =>
								`${area}@${measureValuesUrl({ ...whole, periods: [ALL_PERIODS] })}`,
						)
						.join(" "),
					load: async () => {
						const read = await Promise.all(
							requests.map(({ area, whole }) =>
								loadMeasureHistory(whole).then(
									(payload) => ({ area, payload }),
									() => null,
								),
							),
						);
						return read.filter(
							(entry): entry is EarlierPayload => entry !== null,
						);
					},
				}
			: null,
	);
}
