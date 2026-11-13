import {
	ATLAS_LOCATIONS,
	ATLAS_MAPS,
	atlasLocationsFor,
} from "@/lib/atlas/pages";
import {
	CATALOGUE_DATASET_DEFINITIONS,
	DATASET_TREE,
	REGISTERED_DATASETS,
} from "@uk-data-atlas/datasets";
import { datasetSlug } from "@/lib/datasets";
import {
	type Catalogue,
	nationList,
	releasesForGeography,
	sourceSummaries,
} from "@/lib/docs/catalogue";
import { GEOGRAPHIES, GEOGRAPHY_GROUPS } from "@/lib/docs/content/geographies";
import { datasetPageHref, geographyHref } from "@/lib/docs/navigation";
import { BOUNDARY_DETAILS } from "./boundaries";

/**
 * What the /datasets and /boundaries pages show, gathered from the dataset
 * registry, the boundary catalogue and the registry's guides.
 */

export type DatasetEntry = ReturnType<typeof datasetEntries>[number];
export type BoundaryEntry = ReturnType<typeof boundaryEntries>[number];

/** The link to a geography's section on /boundaries. */
export const boundaryHref = (geography: string) =>
	`/boundaries#${GEOGRAPHIES[geography]?.slug ?? geography}`;

/** The link to a dataset's section on /datasets. */
export const datasetHref = (slug: string) => `/datasets#${slug}`;

export function datasetEntries(catalogue: Catalogue) {
	const definitions = new Map(
		CATALOGUE_DATASET_DEFINITIONS.map((definition) => [
			datasetSlug(definition.type),
			definition,
		]),
	);
	return REGISTERED_DATASETS.map((dataset) => {
		const slug = dataset.id;
		const definition = definitions.get(slug);
		const published = catalogue.datasets.find((d) => d.id === slug);
		const sources = sourceSummaries(catalogue, [slug]);
		const countries =
			definition?.coverageCountries ??
			sources.flatMap((source) => source.countries);
		const geography =
			definition?.boundaryType ?? sources[0]?.geography ?? null;
		const maps = ATLAS_MAPS.filter((map) => map.dataset === slug).map(
			(map) => {
				// The widest place the map has a page for.
				const location =
					atlasLocationsFor(map)[0] ?? ATLAS_LOCATIONS[0];
				return {
					name: map.name,
					href: `/atlas/${location.slug}/${map.slug}`,
				};
			},
		);
		return {
			slug,
			...dataset,
			publisher:
				definition?.source.source ?? published?.publisher ?? null,
			sourceUrl:
				definition?.source.sourceUrl ?? published?.sourceUrl ?? null,
			years:
				definition?.source.year ?? published?.temporalCoverage ?? null,
			licence:
				definition?.source.licence ?? published?.licence?.name ?? null,
			licenceUrl:
				definition?.source.licenceUrl ??
				published?.licence?.url ??
				null,
			description:
				definition?.source.description ??
				published?.description ??
				null,
			geography,
			geographyTitle: geography
				? (GEOGRAPHIES[geography]?.title ?? geography)
				: null,
			coverage: countries.length > 0 ? nationList(countries) : null,
			maps,
			docsHref: datasetPageHref(slug),
		};
	});
}

/** Themes, then topics, in registry order, each with its datasets' entries. */
export function datasetsByTheme(entries: DatasetEntry[]) {
	return DATASET_TREE.map(({ theme, topics }) => ({
		theme,
		topics: topics.map(({ topic, datasets }) => ({
			topic,
			datasets: datasets.flatMap((dataset) =>
				entries.filter((entry) => entry.slug === dataset.id),
			),
		})),
	}));
}

export function boundaryEntries(catalogue: Catalogue) {
	const datasets = datasetEntries(catalogue);
	return Object.entries(GEOGRAPHIES).map(([id, content]) => {
		const releases = releasesForGeography(catalogue, id);
		const latest = releases[0];
		return {
			id,
			...content,
			detail: BOUNDARY_DETAILS[id],
			releases: releases.length,
			latest,
			areas: latest
				? catalogue.areaCounts.get(`${id}/${latest.id}`)
				: undefined,
			coverage: latest ? nationList(latest.coverage.countries) : null,
			datasets: datasets.filter(
				(dataset) =>
					dataset.geography === id || dataset.publishedOn === id,
			),
			docsHref: geographyHref(id),
		};
	});
}

export function boundariesByGroup(entries: BoundaryEntry[]) {
	return GEOGRAPHY_GROUPS.map((group) => ({
		...group,
		boundaries: entries.filter((entry) => entry.group === group.id),
	}));
}
