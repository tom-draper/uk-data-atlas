import type { SelectedArea } from "@/lib/types";
import {
	selectedAreaLadCode,
	type LadResolver,
} from "@/lib/helpers/selectedAreaLad";
import { formatCount } from "@/lib/helpers/formatCount";
import type { DeprivationCardConfig } from "./deprivationCard";

/**
 * One earlier edition of a deprivation index, as a position in its own year.
 * A row holds only that edition's published figures: there is deliberately no
 * field for a difference from another edition, so none can be shown.
 */
export type EarlierEditionRow =
	| {
			kind: "area";
			year: number;
			decile: number | null;
			rank: number | null;
			/** How many small areas that edition ranks. */
			areaCount: number;
	  }
	| {
			kind: "summary";
			year: number;
			mostDeprivedCount: number;
			areaCount: number;
	  }
	| { kind: "noMatch"; year: number; area: "smallArea" | "authority" };

/** One edition's records and authority summaries, as the payload holds them. */
export type EditionDataset = {
	data: { [code: string]: { [field: string]: unknown } };
	[summaryField: string]: unknown;
};

/**
 * MHCLG's guidance on comparing editions, kept close to its own wording
 * ("English Indices of Deprivation 2019: Frequently asked questions", Q22 and
 * Q23): changes can only be described in relative terms and cannot identify
 * real change in deprivation, and ranks and deciles rather than scores should
 * be used for the overall index.
 */
export const EDITIONS_NOTE =
	"Each edition ranks areas against each other at the time, using different indicators and data years. Compare relative position, not scores. A change in decile does not by itself mean an area became more or less deprived.";

const numberAt = (record: { [field: string]: unknown }, field?: string) => {
	const value = field === undefined ? undefined : record[field];
	return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const summaryOf = (dataset: EditionDataset, field: string, code: string) => {
	const summaries = dataset[field] as
		| { [code: string]: { areaCount: number; mostDeprivedCount: number } }
		| undefined;
	return summaries?.[code];
};

/**
 * The earlier editions to list beneath the latest for the current selection,
 * oldest first.
 *
 * Rows are given only where the latest edition has the area, so an index
 * never adds rows for an area outside its nation. A small area is matched to
 * an earlier edition only by an identical code. Statistical geographies keep
 * their code only while their boundary is unchanged: of England's 2011 LSOAs,
 * the ONS lookup (LSOA11_LSOA21_LAD22_EW_LU_v5) marks exactly the 31,810 that
 * keep their code as unchanged, and every split, merged or redrawn LSOA as
 * new. Nothing is apportioned. A local authority, or a ward rolled up to one,
 * is listed only where an authority with the same code, and so the same
 * boundary, is summarised in both editions, and shows only the share of its
 * small areas in the most deprived tenth. That matches MHCLG's published
 * "proportion of LSOAs in most deprived 10% nationally" for every 2015
 * authority; no score is averaged. A whole selection with no area picked has
 * no published summary, so it lists none.
 */
export function earlierEditionRows({
	config,
	latest,
	datasets,
	selectedArea,
	codeMapper,
}: {
	config: Pick<
		DeprivationCardConfig,
		"earlierEditions" | "areaType" | "summaryField" | "decileField"
	>;
	latest: EditionDataset;
	/** The index's payload by edition year, as loaded. */
	datasets: { [year: string]: EditionDataset | undefined };
	selectedArea: SelectedArea | null;
	codeMapper?: LadResolver;
}): EarlierEditionRow[] {
	const earlier = config.earlierEditions;
	if (!earlier || selectedArea === null) return [];

	const ladCode = selectedAreaLadCode(selectedArea, codeMapper);
	const smallArea =
		!ladCode && selectedArea.type === config.areaType
			? selectedArea.code
			: null;
	if (ladCode) {
		if (!summaryOf(latest, config.summaryField, ladCode)) return [];
	} else if (smallArea === null || !latest.data[smallArea]) return [];

	return [...earlier.editions]
		.sort((a, b) => a.year - b.year)
		.flatMap(({ year, areaCount }): EarlierEditionRow[] => {
			const dataset = datasets[String(year)];
			if (!dataset) return [];
			if (ladCode) {
				const summary = summaryOf(
					dataset,
					config.summaryField,
					ladCode,
				);
				return [
					summary
						? {
								kind: "summary",
								year,
								mostDeprivedCount: summary.mostDeprivedCount,
								areaCount: summary.areaCount,
							}
						: { kind: "noMatch", year, area: "authority" },
				];
			}
			const record = dataset.data[smallArea!];
			return [
				record
					? {
							kind: "area",
							year,
							decile: numberAt(record, config.decileField),
							rank: numberAt(record, earlier.rankField),
							areaCount,
						}
					: { kind: "noMatch", year, area: "smallArea" },
			];
		});
}

/**
 * The cells of one earlier-edition row: its year, then that edition's own
 * position, stated without reference to any other edition.
 */
export function earlierEditionCells(
	row: EarlierEditionRow,
	areaNoun: string,
): [year: string, position: string, detail: string] {
	const year = String(row.year);
	switch (row.kind) {
		case "area":
			return [
				year,
				row.decile === null
					? "No decile"
					: `Decile ${Math.round(row.decile)}`,
				row.rank === null
					? ""
					: `Rank ${formatCount(Math.round(row.rank))} of ${formatCount(row.areaCount)}`,
			];
		case "summary":
			return [
				year,
				`${Math.round((row.mostDeprivedCount / row.areaCount) * 100)}% in most deprived 10%`,
				`${formatCount(row.mostDeprivedCount)} of ${formatCount(row.areaCount)} ${areaNoun}`,
			];
		case "noMatch":
			return [year, "Boundaries changed, no direct match", ""];
	}
}
