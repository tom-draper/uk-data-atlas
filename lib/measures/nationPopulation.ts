import { loadMeasureValues, restrictToAreas } from "./cache";
import { MeasureQueryError, valuesByCode } from "./client";
import { isSummable } from "./combine";
import type { MeasureValuesPayload, MeasureValuesRequest } from "./types";

/** One area's population, by sex and, where published, single year of age. */
export type NationPopulation = {
	/** The estimate's year, such as `2025` for mid-2025. */
	period: string | null;
	/** The dataset that published it, for its source label. */
	datasetId: string | null;
	males: number | null;
	females: number | null;
	/** Males and females at each age, oldest last; null where not published. */
	ages: Array<{ age: number; males: number; females: number }> | null;
};

type Load = (
	request: Omit<MeasureValuesRequest, "areas">,
) => Promise<MeasureValuesPayload>;

/** Where to read the population: one area on one release. */
export type PopulationTarget = {
	geography: string;
	boundaryYear: number;
	code: string;
};

const SEXES = ["male", "female"] as const;

const ask = async (
	load: Load,
	target: PopulationTarget,
	dimensions: Record<string, string[]>,
	datasetId?: string,
): Promise<MeasureValuesPayload | null> => {
	try {
		return await load({
			measure: "population",
			geography: target.geography,
			boundaryYear: target.boundaryYear,
			dimensions,
			...(datasetId ? { datasetId } : {}),
		});
	} catch (error) {
		if (error instanceof MeasureQueryError && error.status < 500)
			return null;
		throw error;
	}
};

const valueAt = (
	payload: MeasureValuesPayload | null,
	code: string,
	period: string,
): number | null => {
	if (!payload || !isSummable(payload)) return null;
	return (
		valuesByCode(restrictToAreas(payload, [code]), period).get(code) ?? null
	);
};

const EMPTY: NationPopulation = {
	period: null,
	datasetId: null,
	males: null,
	females: null,
	ages: null,
};

/**
 * An area's population by sex, and by single year of age where a source
 * publishes it, from the measures route. The source that answers the
 * youngest males is asked for every other age, so the ages all come from one
 * dataset and one period; their sum is the area's total, as the ages split
 * the whole population. Where no source publishes ages, the sexes are read
 * on their own. A figure the route refuses is left out, never filled in from
 * others.
 */
export async function loadNationPopulation(
	target: PopulationTarget,
	ageCodes: readonly string[],
	load: Load = loadMeasureValues,
): Promise<NationPopulation> {
	const first = ageCodes.length
		? await ask(load, target, { sex: ["male"], age: [ageCodes[0]!] })
		: null;
	const firstPeriod = first?.periods.at(-1);
	if (first && firstPeriod) {
		const datasetId = first.source.datasetId;
		const byAge = await Promise.all(
			ageCodes.flatMap((age) =>
				SEXES.map((sex) =>
					ask(load, target, { sex: [sex], age: [age] }, datasetId),
				),
			),
		);
		const ages: NonNullable<NationPopulation["ages"]> = [];
		for (let index = 0; index < ageCodes.length; index++) {
			const males = valueAt(byAge[index * 2]!, target.code, firstPeriod);
			const females = valueAt(
				byAge[index * 2 + 1]!,
				target.code,
				firstPeriod,
			);
			if (males == null || females == null) break;
			ages.push({ age: index, males, females });
		}
		if (ages.length === ageCodes.length)
			return {
				period: firstPeriod,
				datasetId,
				males: ages.reduce((sum, age) => sum + age.males, 0),
				females: ages.reduce((sum, age) => sum + age.females, 0),
				ages,
			};
	}

	const males = await ask(load, target, { sex: ["male"] });
	const period = males?.periods.at(-1);
	if (!males || !period) return EMPTY;
	const datasetId = males.source.datasetId;
	const females = await ask(load, target, { sex: ["female"] }, datasetId);
	return {
		period,
		datasetId,
		males: valueAt(males, target.code, period),
		females: valueAt(females, target.code, period),
		ages: null,
	};
}
