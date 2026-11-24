"use client";

import {
	AGE,
	DATASET_DECLARATIONS,
	DATASET_GUIDES,
} from "@uk-data-atlas/datasets";
import { formatCount } from "@/lib/helpers/formatCount";
import { getChartDatasetDefinition } from "@/lib/datasets";
import {
	selectedAreaLadCode,
	type LadResolver,
} from "@/lib/helpers/selectedAreaLad";
import {
	loadNationPopulation,
	type NationPopulation,
	type PopulationTarget,
} from "@/lib/measures/nationPopulation";
import { useLoaded } from "@/lib/measures/useLoaded";
import type { SelectedArea } from "@/lib/types/areas";
import { CENSUS_NATIONS } from "./useNationCensusCard";

/** The population cards' figures for an area in Scotland or Northern Ireland. */
export type NationPopulationState = {
	nation: string;
	status: "loading" | "ready";
	/** The council or data zone read, or null where the nation has none. */
	target: PopulationTarget | null;
	/** The figures, or null where the nation publishes none for this area. */
	population: NationPopulation | null;
	/** Where the figures come from, or why there are none. */
	source: string;
	/** A short line naming the publisher and year, or what is missing. */
	note: string;
};

const AGE_CODES = (AGE.members ?? []).map(
	(member) => member.code ?? member.key,
);

/** The country each nation's codes belong to, by their initial. */
const NATION_COUNTRIES: Readonly<Record<string, string>> = {
	S: "GB-SCT",
	N: "GB-NIR",
};

const notPublished = (
	nation: string,
	source: string,
): NationPopulationState => ({
	nation,
	status: "ready",
	target: null,
	population: null,
	source,
	note: `Not published in this form for ${nation}`,
});

/** The council or data zone the nation publishes for, if any. */
const targetOf = (
	selectedArea: SelectedArea,
	initial: string,
	codeMapper: LadResolver | undefined,
): PopulationTarget | undefined => {
	if (selectedArea.type === "dataZone")
		return selectedArea.boundaryYear
			? {
					geography: "dataZone",
					boundaryYear: selectedArea.boundaryYear,
					code: selectedArea.code,
				}
			: undefined;
	if (selectedArea.type !== "localAuthority") return undefined;
	const code = selectedAreaLadCode(selectedArea, codeMapper);
	return code?.startsWith(initial) && selectedArea.boundaryYear
		? {
				geography: "localAuthority",
				boundaryYear: selectedArea.boundaryYear,
				code,
			}
		: undefined;
};

/**
 * The population of a Scottish or Northern Irish council or data zone, for
 * cards whose dataset covers England and Wales only. Each nation publishes
 * its own mid-year estimates for councils and data zones; the measures route
 * chooses the source, and the card names it. Null where the dataset covers
 * the area itself.
 */
export function useNationPopulation(
	dataset: { type: string; coverageCountries?: readonly string[] },
	selectedArea: SelectedArea | null,
	codeMapper: LadResolver | undefined,
): NationPopulationState | null {
	const coverageCountries =
		dataset.coverageCountries ??
		getChartDatasetDefinition(dataset.type)?.coverageCountries;
	const initial = selectedArea?.code.charAt(0) ?? "";
	const country = NATION_COUNTRIES[initial];
	const nation =
		country &&
		coverageCountries?.length &&
		!coverageCountries.includes(country)
			? CENSUS_NATIONS[initial]
			: undefined;
	const target =
		nation && selectedArea
			? targetOf(selectedArea, initial, codeMapper)
			: undefined;
	const loaded = useLoaded(
		target
			? {
					key: `population|${target.geography}|${target.boundaryYear}|${target.code}`,
					load: () => loadNationPopulation(target, AGE_CODES),
				}
			: null,
	);

	if (!nation || !selectedArea) return null;
	if (!target)
		return notPublished(
			nation,
			`${nation} publishes population estimates for councils and data zones, not for a ${selectedArea.type === "ward" ? "ward" : "this kind of area"}.`,
		);
	if (loaded.status === "error")
		return { ...notPublished(nation, loaded.error.message), target };
	if (loaded.status !== "ready")
		return { ...notPublished(nation, ""), status: "loading", target };

	const population = loaded.value;
	if (!population.period || !population.datasetId)
		return {
			...notPublished(
				nation,
				`${nation}'s population estimates are not published for this area.`,
			),
			target,
		};
	if (population.kind === "census") {
		const guide =
			DATASET_GUIDES[population.datasetId as keyof typeof DATASET_GUIDES];
		return {
			nation,
			status: "ready",
			target,
			population,
			source: `${guide?.title ?? population.datasetId}. ${nation} publishes no mid-year estimate for this area, so this is its census count of usual residents.${guide?.summary ? ` ${guide.summary}` : ""}`,
			note: `${nation}, Census ${population.period}`,
		};
	}
	const declaration = DATASET_DECLARATIONS.find(
		({ id }) => id === population.datasetId,
	);
	const publisher = declaration?.source.publisher ?? nation;
	const name = declaration?.source.name ?? population.datasetId;
	return {
		nation,
		status: "ready",
		target,
		population,
		source: `${publisher}. ${name}, mid-${population.period}.${declaration?.guide?.summary ? ` ${declaration.guide.summary}` : ""}`,
		note: `${nation}, ${publisher} mid-${population.period} estimate`,
	};
}

/** When a nation's figure is from, as a card's coverage line names it. */
const whenOf = (population: NationPopulation | null): string =>
	!population?.period
		? ""
		: population.kind === "census"
			? `, Census ${population.period}`
			: `, mid-${population.period}`;

/**
 * A population card's coverage line where the area's nation differs from the
 * dataset's, so a figure is never read against the other nations' year.
 */
export const formatNationCoverage = (
	state: NationPopulationState,
	elsewhere: string | undefined,
	year: number,
): string =>
	`Here: ${state.nation}${whenOf(state.population)}. Elsewhere: ${elsewhere ?? "England & Wales"}, mid-${year}.`;

/** Why a population card's age chart is empty for a nation's area. */
export const nationAgesMessage = (state: NationPopulationState): string => {
	const population = state.population;
	if (!population || population.ages) return state.note;
	if (population.males == null && population.total != null)
		return `Not split by sex or age here. Total ${formatCount(population.total)} (${state.note})`;
	return `${state.nation} does not publish single years of age for this kind of area`;
};
