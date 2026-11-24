"use client";

import { DATASET_GUIDES } from "@uk-data-atlas/datasets";
import type { ValueCardConfig, ValueCardStats } from "@/lib/datasets/valueCard";
import {
	selectedAreaLadCode,
	type LadResolver,
} from "@/lib/helpers/selectedAreaLad";
import { loadNationCensus } from "@/lib/measures/nationCensus";
import { useLoaded } from "@/lib/measures/useLoaded";
import type { SelectedArea } from "@/lib/types/areas";
import { useCouncilDataZones } from "./useCouncilDataZones";

/** The nations a dataset can leave out that publish their own census. */
export const CENSUS_NATIONS: Readonly<Record<string, string>> = {
	S: "Scotland",
	N: "Northern Ireland",
};

/** What a card shows for an area in a nation its dataset does not cover. */
export type NationCardState = {
	nation: string;
	status: "loading" | "ready";
	/** The card's figures, or null where the nation does not publish them. */
	stats: ValueCardStats | null;
	/** The census the figures come from, such as `2022`. */
	period: string | null;
	/** Where the figures come from, or why there are none. */
	source: string;
	/** A short line under the value, naming the nation's census. */
	note: string;
};

const notPublished = (nation: string, reason: string): NationCardState => ({
	nation,
	status: "ready",
	stats: null,
	period: null,
	source: reason,
	note: `Not published in this form for ${nation}`,
});

/**
 * A card's figures for an area in Scotland or Northern Ireland, where the
 * dataset covers England and Wales only: the nation's own census, summed
 * from its data zones. Null where the card reads the area itself.
 */
export function useNationCensusCard(
	card: ValueCardConfig | undefined,
	selectedArea: SelectedArea | null,
	codeMapper: LadResolver | undefined,
): NationCardState | null {
	const nations = card?.nations;
	const initial = selectedArea?.code.charAt(0) ?? "";
	const nation = nations?.covers.includes(initial)
		? undefined
		: CENSUS_NATIONS[initial];
	const isZone = selectedArea?.type === "dataZone";
	// Only a council is summed from its data zones: a ward's council total
	// would be read as the ward's own figure.
	const ladCode =
		nation && selectedArea?.type === "localAuthority"
			? selectedAreaLadCode(selectedArea, codeMapper)
			: undefined;
	const council = useCouncilDataZones(
		ladCode?.startsWith(initial) ? ladCode : undefined,
	);
	const target =
		isZone && selectedArea?.boundaryYear
			? {
					key: selectedArea.code,
					boundaryYear: selectedArea.boundaryYear,
					zones: [selectedArea.code],
				}
			: council.status === "ready" && council.dataZones
				? { key: ladCode!, ...council.dataZones }
				: undefined;
	const loaded = useLoaded(
		nation && nations && target
			? {
					key: `${nations.measure}|${nations.dimension}|${target.boundaryYear}|${target.key}`,
					load: () =>
						loadNationCensus(
							nations,
							target.boundaryYear,
							target.zones,
						),
				}
			: null,
	);

	if (!nation || !nations || !selectedArea) return null;
	if (!target) {
		if (
			!isZone &&
			ladCode?.startsWith(initial) &&
			(council.status === "loading" || council.status === "idle")
		)
			return { ...notPublished(nation, ""), status: "loading" };
		return notPublished(
			nation,
			`${nation} publishes its census on data zones, which are summed to councils. They are not summed to a ${selectedArea.type === "ward" ? "ward" : "this kind of area"}.`,
		);
	}
	if (loaded.status !== "ready")
		return loaded.status === "error"
			? notPublished(nation, loaded.error.message)
			: { ...notPublished(nation, ""), status: "loading" };

	const census = loaded.value;
	const guide = census.datasetId
		? DATASET_GUIDES[census.datasetId as keyof typeof DATASET_GUIDES]
		: undefined;
	const stats = Object.keys(census.metrics).length
		? nations.fromMetrics(census.metrics)
		: null;
	const where = isZone
		? "for this data zone"
		: "data zones summed to the council";
	if (!stats || !guide)
		return notPublished(
			nation,
			guide
				? `${guide.title}, ${where}. ${guide.summary}`
				: `${nation}'s census does not publish this measure on data zones.`,
		);
	return {
		nation,
		status: "ready",
		stats,
		period: census.period,
		source: `${guide.title}, ${where}. ${guide.summary}`,
		note: `${nation}, Census ${census.period}`,
	};
}
