import {
	loadCatalogue,
	measuresFromDatasets,
	measuresOnGeography,
	nationList,
	periodRange,
	sourceSummaries,
	type Catalogue,
	type CatalogueMeasure,
} from "./catalogue";
import { DATA_PAGES, type DataPage } from "./content/data";
import { GEOGRAPHIES } from "./content/geographies";

/** Everything a data page shows, gathered from the catalogue. */
export function dataPageFacts(page: DataPage, catalogue = loadCatalogue()) {
	const datasets = catalogue.datasets.filter((d) =>
		page.datasets.includes(d.id),
	);
	const measures = measuresFromDatasets(catalogue, page.datasets);
	const sources = sourceSummaries(catalogue, page.datasets);
	const periods = sources.flatMap((s) => s.periods);
	// Every year a period names, so 2020-2022 reaches 2022.
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

export function findDataPage(slug: string): DataPage | undefined {
	return DATA_PAGES.find((page) => page.slug === slug);
}

/** The data pages with anything published on a geography. */
export function dataPagesOnGeography(
	geography: string,
	catalogue: Catalogue = loadCatalogue(),
) {
	const measureIds = new Set(
		measuresOnGeography(catalogue, geography).map((m) => m.id),
	);
	return DATA_PAGES.map((page) => {
		const sources = sourceSummaries(catalogue, page.datasets).filter(
			(source) =>
				source.geography === geography &&
				source.measureIds.some((id) => measureIds.has(id)),
		);
		return { page, sources };
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
