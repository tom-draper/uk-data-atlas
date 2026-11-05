import { measureValuesUrl } from "./request";
import {
	isNumericColumn,
	type MeasureColumn,
	type MeasureValuesErrorBody,
	type MeasureValuesPayload,
	type MeasureValuesRequest,
} from "./types";

/** A refusal or failure from the measure route. */
export class MeasureQueryError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string,
		readonly choices?: Array<Record<string, unknown>>,
	) {
		super(message);
		this.name = "MeasureQueryError";
	}
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** Ask the website for a measure's values. Throws `MeasureQueryError`. */
export async function fetchMeasureValues(
	request: MeasureValuesRequest,
	options: { signal?: AbortSignal; fetch?: Fetch } = {},
): Promise<MeasureValuesPayload> {
	const response = await (options.fetch ?? fetch)(measureValuesUrl(request), {
		signal: options.signal,
	});
	if (!response.ok) {
		let body: Partial<MeasureValuesErrorBody> | undefined;
		try {
			body = (await response.json()) as MeasureValuesErrorBody;
		} catch {
			body = undefined;
		}
		throw new MeasureQueryError(
			response.status,
			body?.error?.code ?? "request_failed",
			body?.error?.detail ?? `HTTP ${response.status}`,
			body?.error?.choices,
		);
	}
	return (await response.json()) as MeasureValuesPayload;
}

/** One area's value for a period, as a row. */
export type MeasureRow = {
	code: string;
	/** The number for a numeric measure; null where there is none. */
	value: number | null;
	/** The category for a categorical measure. */
	category?: string | null;
	status: string;
	lower?: number | null;
	upper?: number | null;
};

/** The column for a period, or undefined if the response does not hold it. */
export const columnFor = (
	payload: MeasureValuesPayload,
	period: string,
): MeasureColumn | undefined =>
	payload.columns.find((column) => column.period === period);

/** A period's values as one row per area, in the response's order. */
export function measureRows(
	payload: MeasureValuesPayload,
	period: string,
): MeasureRow[] {
	const column = columnFor(payload, period);
	if (!column) return [];
	return payload.areas.map((code, index) => ({
		code,
		value: isNumericColumn(column) ? (column.values[index] ?? null) : null,
		...(isNumericColumn(column)
			? {}
			: { category: column.categories[index] ?? null }),
		status: payload.statuses[column.status[index] ?? -1] ?? "missing",
		...(isNumericColumn(column) && column.lower
			? {
					lower: column.lower[index] ?? null,
					upper: column.upper?.[index] ?? null,
				}
			: {}),
	}));
}

/** A period's numeric values by area code, leaving out areas with none. */
export function valuesByCode(
	payload: MeasureValuesPayload,
	period: string,
): Map<string, number> {
	const column = columnFor(payload, period);
	const values = new Map<string, number>();
	if (!column || !isNumericColumn(column)) return values;
	payload.areas.forEach((code, index) => {
		const value = column.values[index];
		if (typeof value === "number") values.set(code, value);
	});
	return values;
}

/** One area's value in every period the response holds, in its order. */
export function areaSeries(
	payload: MeasureValuesPayload,
	code: string,
): Array<{ period: string; value: number | null }> {
	const index = payload.areas.indexOf(code);
	if (index === -1) return [];
	return payload.columns.map((column) => ({
		period: column.period,
		value: isNumericColumn(column) ? (column.values[index] ?? null) : null,
	}));
}
