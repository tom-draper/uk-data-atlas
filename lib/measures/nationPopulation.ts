import { loadMeasureValues, restrictToAreas } from "./cache";
import { MeasureQueryError, valuesByCode } from "./client";
import { isSummable } from "./combine";
import type { MeasureValuesPayload, MeasureValuesRequest } from "./types";

/** One area's population, by sex and, where published, single year of age. */
export type NationPopulation = {
	/** The figure's year: `2025` for a mid-2025 estimate, `2022` for a census. */
	period: string | null;
	/** The dataset that published it, for its source label. */
	datasetId: string | null;
	/** A mid-year estimate, or a census count where no estimate is published. */
	kind: "estimate" | "census" | null;
	/** Everyone in the area, as published or as the sexes add to. */
	total: number | null;
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
): Promise<MeasureValuesPayload | null> =>
	request(load, {
		measure: "population",
		geography: target.geography,
		boundaryYear: target.boundaryYear,
		dimensions,
		...(datasetId ? { datasetId } : {}),
	});

const request = async (
	load: Load,
	query: Omit<MeasureValuesRequest, "areas">,
): Promise<MeasureValuesPayload | null> => {
	try {
		return await load(query);
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
	kind: null,
	total: null,
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
 * on their own, and where none publishes the sexes, the area's total: a
 * mid-year estimate on any release that holds the code, or else the census
 * count of usual residents, marked as a census so it is labelled with its
 * own year. A figure the route refuses is left out, never filled in from
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
		if (ages.length === ageCodes.length) {
			const males = ages.reduce((sum, age) => sum + age.males, 0);
			const females = ages.reduce((sum, age) => sum + age.females, 0);
			return {
				period: firstPeriod,
				datasetId,
				kind: "estimate",
				total: males + females,
				males,
				females,
				ages,
			};
		}
	}

	const males = await ask(load, target, { sex: ["male"] });
	const period = males?.periods.at(-1);
	if (males && period) {
		const datasetId = males.source.datasetId;
		const females = await ask(load, target, { sex: ["female"] }, datasetId);
		const male = valueAt(males, target.code, period);
		const female = valueAt(females, target.code, period);
		return {
			period,
			datasetId,
			kind: "estimate",
			total: male != null && female != null ? male + female : null,
			males: male,
			females: female,
			ages: null,
		};
	}
	return (
		(await totalOf(
			load,
			target,
			// A council's code stays the same across releases, so the
			// estimate is read on whichever release publishes it.
			{ measure: "population", geography: target.geography },
			"estimate",
		)) ??
		(await totalOf(
			load,
			target,
			{
				measure: "usual-residents",
				geography: target.geography,
				boundaryYear: target.boundaryYear,
			},
			"census",
		)) ??
		EMPTY
	);
}

const totalOf = async (
	load: Load,
	target: PopulationTarget,
	query: Omit<MeasureValuesRequest, "areas">,
	kind: "estimate" | "census",
): Promise<NationPopulation | null> => {
	const payload = await request(load, query);
	const period = payload?.periods.at(-1);
	const total = period ? valueAt(payload, target.code, period) : null;
	return payload && period && total != null
		? {
				...EMPTY,
				period,
				datasetId: payload.source.datasetId,
				kind,
				total,
			}
		: null;
};
