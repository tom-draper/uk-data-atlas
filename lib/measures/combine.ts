import { areaSeries, columnFor, valuesByCode } from "./client";
import type { SeriesPoint } from "./series";
import type { MeasureValuesPayload } from "./types";

/**
 * Whether a measure's values add up over areas, as its own metadata says.
 * Counts do; a rate, a median or a rank does not.
 */
export const isSummable = (payload: MeasureValuesPayload): boolean => {
	const { aggregation } = payload.measure;
	return aggregation.kind === "extensive" && aggregation.available === true;
};

/** Each period's total over every area in the response, for a summable measure. */
export function summedSeries(payload: MeasureValuesPayload): SeriesPoint[] {
	if (!isSummable(payload)) return [];
	return payload.columns.map((column) => {
		const values = valuesByCode(payload, column.period);
		return {
			period: column.period,
			value:
				values.size > 0
					? [...values.values()].reduce(
							(sum, value) => sum + value,
							0,
						)
					: null,
		};
	});
}

/**
 * A rate over every area in the response, as a percentage. A rate cannot be
 * averaged, so each area's count over its rate gives the base the rate is of,
 * and the figure is the counts over the bases. Areas missing either, or with
 * a rate of nothing, are left out of that period.
 */
export function ratioSeries(
	rates: MeasureValuesPayload,
	counts: MeasureValuesPayload,
): SeriesPoint[] {
	return rates.columns.map((column) => {
		const rate = valuesByCode(rates, column.period);
		const count = columnFor(counts, column.period)
			? valuesByCode(counts, column.period)
			: new Map<string, number>();
		let top = 0;
		let base = 0;
		for (const [code, value] of rate) {
			const level = count.get(code);
			if (level === undefined || !(value > 0)) continue;
			top += level;
			base += (level / value) * 100;
		}
		return {
			period: column.period,
			value: base > 0 ? (top / base) * 100 : null,
		};
	});
}

/**
 * One area's values over periods, or, with no area, those of every area in
 * the response combined. The response is read for the areas in scope, so
 * "every area" is the location the map is showing.
 */
export const readSeries = (
	payload: MeasureValuesPayload,
	area: string | null,
): SeriesPoint[] =>
	area === null ? summedSeries(payload) : areaSeries(payload, area);
