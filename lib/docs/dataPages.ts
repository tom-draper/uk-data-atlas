import {
	measuresFromDatasets,
	measuresOnGeography,
	nationList,
	periodRange,
	sourceSummaries,
	type Catalogue,
	type CatalogueMeasure,
} from "./catalogue";
import { REGISTERED_DATASETS } from "@uk-data-atlas/datasets";
import { GEOGRAPHIES } from "./content/geographies";

/** Everything a page about some datasets shows, gathered from the catalogue. */
export function dataPageFacts(
	datasetIds: readonly string[],
	catalogue: Catalogue,
) {
	const datasets = catalogue.datasets.filter((d) =>
		datasetIds.includes(d.id),
	);
	const measures = measuresFromDatasets(catalogue, datasetIds);
	const sources = sourceSummaries(catalogue, datasetIds);
	const periods = sources.flatMap((s) => s.periods);
	// Every year a period names, so 2022-2024 reaches 2024.
	const years = periods.flatMap((p) =>
		[...p.matchAll(/\d{4}/g)].map((match) => Number(match[0])),
	);

	return {
		datasets,
		measures,
		sources,
		publishers: [...new Set(datasets.map((d) => d.publisher))],
		licences: [
			...new Map(
				datasets
					.filter((d) => d.licence)
					.map((d) => [d.licence!.name, d.licence!]),
			).values(),
		],
		nations: nationList(sources.flatMap((s) => s.countries)),
		geographies: [...new Set(sources.map((s) => s.geography))],
		years:
			years.length === 0
				? null
				: { from: Math.min(...years), to: Math.max(...years) },
		/** Set when every source shares one period, such as a census year. */
		singlePeriod:
			new Set(periods).size === 1 ? periodRange([periods[0]]) : null,
	};
}

export function yearSpan(years: { from: number; to: number } | null): string {
	if (!years) return "Varies";
	return years.from === years.to
		? String(years.from)
		: `${years.from} to ${years.to}`;
}

/** Whether and how a measure's values can be combined over areas. */
export function combining(measure: CatalogueMeasure): string {
	const { kind, operation, available } = measure.aggregation;
	if (kind === "extensive") return available ? "Adds up" : "Not combined";
	if (kind === "intensive" && operation === "weighted-mean" && available) {
		return "Weighted average";
	}
	return "Not combined";
}

/** The registry datasets with anything published on a geography. */
export function dataPagesOnGeography(geography: string, catalogue: Catalogue) {
	const measureIds = new Set(
		measuresOnGeography(catalogue, geography).map((m) => m.id),
	);
	return REGISTERED_DATASETS.map((dataset) => {
		const sources = sourceSummaries(catalogue, [dataset.id]).filter(
			(source) =>
				source.geography === geography &&
				source.measureIds.some((id) => measureIds.has(id)),
		);
		return { dataset, sources };
	}).filter(({ sources }) => sources.length > 0);
}

export function findGeographyBySlug(slug: string): string | undefined {
	return Object.entries(GEOGRAPHIES).find(
		([, content]) => content.slug === slug,
	)?.[0];
}

export function capitalise(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * A measure's unit as a table cell: "People", "Score out of 24". A unit that
 * opens with a symbol or abbreviation ("kt CO2e", "µg/m³", "£ per year") is
 * left as written, since capitalising it would change what it means.
 */
export function unitLabel(unit: string): string {
	return /^[a-z]{3,}(\s|$)/.test(unit) ? capitalise(unit) : unit;
}
