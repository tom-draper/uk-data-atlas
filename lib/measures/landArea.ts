import { loadMeasureValues, restrictToAreas } from "./cache";
import { MeasureQueryError, valuesByCode } from "./client";
import type { MeasureValuesPayload, MeasureValuesRequest } from "./types";

/** A council's land area, as its publisher measured it. */
export type LandArea = {
	sqKm: number;
	period: string;
	datasetId: string;
};

type Load = (
	request: Omit<MeasureValuesRequest, "areas">,
) => Promise<MeasureValuesPayload>;

const HECTARES_PER_SQ_KM = 100;

/**
 * A local authority's land area from the measures route: land only, without
 * inland water, as population density is calculated from. Null where the
 * route publishes none for the council.
 */
export async function loadLandArea(
	code: string,
	load: Load = loadMeasureValues,
): Promise<LandArea | null> {
	let payload: MeasureValuesPayload;
	try {
		payload = await load({
			measure: "area",
			geography: "localAuthority",
			dimensions: { surface: ["land"] },
		});
	} catch (error) {
		if (error instanceof MeasureQueryError && error.status < 500)
			return null;
		throw error;
	}
	const period = payload.periods.at(-1);
	if (!period || payload.measure.unit !== "hectares") return null;
	const hectares = valuesByCode(restrictToAreas(payload, [code]), period).get(
		code,
	);
	return hectares
		? {
				sqKm: hectares / HECTARES_PER_SQ_KM,
				period,
				datasetId: payload.source.datasetId,
			}
		: null;
}
