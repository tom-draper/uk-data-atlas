import { useMemo } from "react";
import { breakdownView, type BreakdownView } from "@/lib/measures/breakdown";
import { areaCodesInScope, requestAreas } from "@/lib/measures/scope";
import { useMeasureMembers } from "@/lib/measures/useMeasureMembers";
import { PARTIES } from "@uk-data-atlas/datasets";
import { categoryBreakdown } from "@/lib/datasets/categories";
import { aggregateDataset } from "@/lib/helpers/aggregateDataset";
import type { MapManager } from "@/lib/helpers/mapManager/mapManager";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";
import type {
	ConstituencyStats,
	Dataset,
	Datasets,
	PartyCode,
	WardStats,
} from "@/lib/types";
import type { BoundaryData } from "@uk-data-atlas/datasets";
import type {
	CategoryDisplayData,
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
		activeDataset.type === "local-election"
			? (aggregates["local-election"] as
					Record<number, WardStats> | undefined)
			: activeDataset.type === "general-election"
				? (aggregates["general-election"] as
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

/** The groups of a breakdown with something in them, the biggest first. */
export function categoryLegendItems(
	view: BreakdownView | null,
): CategoryDisplayData[] {
	return (view?.shares ?? [])
		.filter((share) => share.count > 0)
		.map((share) => ({
			id: share.label,
			color: share.color,
			name: share.label,
		}));
}

/**
 * The legend of a dataset mapped by its largest group: each group's total
 * over the areas on the map, from the same measure queries as its chart.
 * Empty for any other dataset, and until the totals are read.
 */
export function useCategoryLegendItems(
	activeDataset: Dataset | null,
	boundaryData: BoundaryData,
): CategoryDisplayData[] {
	const breakdown = activeDataset
		? categoryBreakdown(activeDataset.type)
		: undefined;
	const geography = breakdown?.request.geography;
	const boundaryYear = breakdown?.request.boundaryYear;
	const scope = useMemo(
		() =>
			geography && boundaryYear !== undefined
				? areaCodesInScope(boundaryData, geography, boundaryYear)
				: null,
		[boundaryData, geography, boundaryYear],
	);
	const state = useMeasureMembers(
		breakdown && scope?.length
			? { ...breakdown.request, areas: requestAreas(scope) }
			: null,
		breakdown?.dimension ?? "",
		breakdown?.parts.map((part) => part.code) ?? [],
	);
	return useMemo(
		() =>
			breakdown && state.status === "ready"
				? categoryLegendItems(
						breakdownView(
							state.payloads,
							null,
							breakdown.dimension,
							breakdown.total,
							breakdown.parts,
							{ order: "largest" },
						),
					)
				: [],
		[breakdown, state],
	);
}
