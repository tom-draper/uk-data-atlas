import type {
	MeasureValues,
	MeasureValuesCategoricalColumn,
	MeasureValuesColumn,
	MeasureValuesRequest,
} from "@uk-data-atlas/measures";

/**
 * The shapes of the website's measure query, shared by the route that serves
 * it and the client that reads it. Type-only: nothing here pulls the server
 * runtime into the browser.
 */

export type { MeasureValuesRequest };

/** The response body: one shared list of areas, then a column per period. */
export type MeasureValuesPayload = Omit<MeasureValues, "ok">;

export type MeasureColumn =
	MeasureValuesColumn | MeasureValuesCategoricalColumn;

/** The body of a refused request. */
export type MeasureValuesErrorBody = {
	error: {
		code: string;
		detail: string;
		choices?: Array<Record<string, unknown>>;
	};
};

export const isNumericColumn = (
	column: MeasureColumn,
): column is MeasureValuesColumn => "values" in column;
