import { loadMeasureValues, restrictToAreas } from "./cache";
import { MeasureQueryError, valuesByCode } from "./client";
import type { MeasureValuesPayload, MeasureValuesRequest } from "./types";

/** A council's population density, as the measures route publishes it. */
export type CouncilDensity = {
	perSqKm: number;
	period: string;
	datasetId: string;
};

type Load = (
	request: Omit<MeasureValuesRequest, "areas">,
) => Promise<MeasureValuesPayload>;

/**
 * A local authority's population density from the measures route: the
 * mid-year estimate over the council's land area, without inland water, in
 * the given year. Null where the route publishes none for the council then.
 */
export async function loadCouncilDensity(
	code: string,
	period: string,
	load: Load = loadMeasureValues,
): Promise<CouncilDensity | null> {
	let payload: MeasureValuesPayload;
	try {
		payload = await load({
			measure: "population-density",
			geography: "localAuthority",
			periods: [period],
		});
	} catch (error) {
		if (error instanceof MeasureQueryError && error.status < 500)
			return null;
		throw error;
	}
	if (!payload.periods.includes(period)) return null;
	const perSqKm = valuesByCode(restrictToAreas(payload, [code]), period).get(
		code,
	);
	return perSqKm
		? { perSqKm, period, datasetId: payload.source.datasetId }
		: null;
}
