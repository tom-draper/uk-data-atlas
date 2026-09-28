import { useMemo } from "react";
import { PARTIES } from "@/lib/data/election/parties";
import { ETHNICITY_COLORS } from "@/lib/helpers/colorScale";
import { aggregateDataset } from "@/lib/helpers/aggregateDataset";
import type { MapManager } from "@/lib/helpers/mapManager/mapManager";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";
import type {
	ConstituencyStats,
	Dataset,
	Datasets,
	Ethnicity,
	EthnicityCategory,
	PartyCode,
	WardStats,
} from "@/lib/types";
import type { BoundaryData } from "@/lib/types/boundaries";
import type {
	EthnicityDisplayData,
	LegendAggregates,
	PartyDisplayData,
} from "./types";

const LEGEND_DEFINITIONS = CHART_DATASET_DEFINITIONS.filter(
	(definition) => definition.legendAggregation,
);

export function useLegendAggregates(
	datasets: Datasets,
	mapManager: MapManager | null,
	boundaryData: BoundaryData,
	location: string | null,
): LegendAggregates {
	return useMemo(
		() =>
			Object.fromEntries(
				LEGEND_DEFINITIONS.flatMap((definition) => {
					const aggregation = definition.legendAggregation;
					if (!aggregation) return [];
					return [
						[
							definition.type,
							aggregateDataset(
								{
									datasets: datasets[definition.type],
									boundaryType: definition.boundaryType,
									keyBy: aggregation.keyBy,
									calculateStats: aggregation.calculateStats,
								},
								mapManager?.datasetAggregator ?? null,
								boundaryData,
								location,
							),
						],
					];
				}),
			) as LegendAggregates,
		[datasets, mapManager, boundaryData, location],
	);
}

export function partyLegendItems(
	activeDataset: Dataset | null,
	aggregates: LegendAggregates,
): PartyDisplayData[] {
	if (!activeDataset) return [];

	const datasetData =
		activeDataset.type === "localElection"
			? (aggregates.localElection as
					Record<number, WardStats> | undefined)
			: activeDataset.type === "generalElection"
				? (aggregates.generalElection as
						Record<number, ConstituencyStats> | undefined)
				: undefined;
	const partyVotes = datasetData?.[activeDataset.year]?.partyVotes;
	if (!partyVotes) return [];

	return Object.entries(partyVotes as Record<PartyCode, number>)
		.filter(([, votes]) => votes > 0)
		.sort(([, a], [, b]) => b - a)
		.map(([id]) => ({
			id: id as PartyCode,
			color: PARTIES[id as PartyCode]?.color || "#ccc",
			name: PARTIES[id as PartyCode]?.name || id,
		}));
}

export function ethnicityLegendItems(
	activeDataset: Dataset | null,
	aggregates: LegendAggregates,
): EthnicityDisplayData[] {
	if (!activeDataset || activeDataset.type !== "ethnicity") return [];
	const yearData = aggregates.ethnicity?.[activeDataset.year];
	if (!yearData) return [];

	const totals = new Map<string, number>();
	for (const localAuthorityData of Object.values(
		yearData,
	) as EthnicityCategory[]) {
		for (const [ethnicity, data] of Object.entries(localAuthorityData) as [
			string,
			Ethnicity,
		][]) {
			if (typeof data.population === "number")
				totals.set(
					ethnicity,
					(totals.get(ethnicity) ?? 0) + data.population,
				);
		}
	}

	return [...totals]
		.filter(([, population]) => population > 0)
		.sort(([, a], [, b]) => b - a)
		.map(([id]) => ({
			id: id as EthnicityDisplayData["id"],
			color: ETHNICITY_COLORS[id] || "#ccc",
			name: id,
		}));
}
