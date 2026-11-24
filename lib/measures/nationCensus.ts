import type { NationCensusCard } from "@/lib/datasets/valueCard";
import { loadMeasureValues, restrictToAreas } from "./cache";
import { MeasureQueryError, valuesByCode } from "./client";
import { isSummable } from "./combine";
import type { MeasureValuesPayload, MeasureValuesRequest } from "./types";

/** A card's members, summed over a nation's data zones. */
export type NationCensus = {
	/** Each member the nation publishes in this form, by record key. */
	metrics: Record<string, number>;
	/** The census the figures come from, such as `2022`. */
	period: string | null;
	/** The dataset that published them, for its source label. */
	datasetId: string | null;
	/** The members the nation does not publish on its data zones. */
	refused: string[];
};

type Load = (
	request: Omit<MeasureValuesRequest, "areas">,
) => Promise<MeasureValuesPayload>;

/**
 * Sum each member a card reads over the given data zones. A member counts
 * only where the measure adds up and every zone has a value; a member the
 * route refuses is one the nation does not publish in this form. Members are
 * asked for one at a time, since a nation may publish each from a different
 * table, and none is ever built from others.
 */
export async function loadNationCensus(
	nations: NationCensusCard,
	boundaryYear: number,
	zones: readonly string[],
	load: Load = loadMeasureValues,
): Promise<NationCensus> {
	const result: NationCensus = {
		metrics: {},
		period: null,
		datasetId: null,
		refused: [],
	};
	if (!zones.length) return result;
	const answers = await Promise.all(
		nations.members.map(async ({ key, code }) => {
			try {
				const payload = await load({
					measure: nations.measure,
					geography: "dataZone",
					boundaryYear,
					dimensions: { [nations.dimension]: [code] },
				});
				return { key, payload };
			} catch (error) {
				if (error instanceof MeasureQueryError && error.status < 500)
					return { key, payload: null };
				throw error;
			}
		}),
	);
	for (const { key, payload } of answers) {
		if (!payload) {
			result.refused.push(key);
			continue;
		}
		const period = payload.periods.at(-1);
		if (!period || !isSummable(payload)) continue;
		const values = valuesByCode(restrictToAreas(payload, zones), period);
		if (values.size !== new Set(zones).size) continue;
		result.metrics[key] = [...values.values()].reduce(
			(sum, value) => sum + value,
			0,
		);
		result.period ??= period;
		result.datasetId ??= payload.source.datasetId;
	}
	return result;
}
