import {
	ATLAS_LOCATIONS,
	ATLAS_MAPS,
	atlasLocationsFor,
} from "@/lib/atlas/pages";
import { CATALOGUE_DATASET_DEFINITIONS } from "@/lib/data/catalog/registry";
import { datasetSlug } from "@/lib/datasets";
import {
	type Catalogue,
	loadCatalogue,
	nationList,
	releasesForGeography,
	sourceSummaries,
} from "@/lib/docs/catalogue";
import { DATA_PAGES } from "@/lib/docs/content/data";
import { GEOGRAPHIES, GEOGRAPHY_GROUPS } from "@/lib/docs/content/geographies";
import { dataPageHref, geographyHref } from "@/lib/docs/navigation";
import { BOUNDARY_DETAILS } from "./boundaries";
import { DATASET_GUIDES, DATASET_TOPICS } from "./datasets";

/**
 * What the /datasets and /geographies pages show, gathered from the dataset
 * registry, the boundary catalogue and the written guides.
 */

export type DatasetEntry = ReturnType<typeof datasetEntries>[number];
export type BoundaryEntry = ReturnType<typeof boundaryEntries>[number];

/** The link to a geography's section on /geographies. */
export const boundaryHref = (geography: string) =>
	`/geographies#${GEOGRAPHIES[geography]?.slug ?? geography}`;

/** The link to a dataset's section on /datasets. */
export const datasetHref = (slug: string) => `/datasets#${slug}`;

export function datasetEntries(catalogue: Catalogue = loadCatalogue()) {
	return CATALOGUE_DATASET_DEFINITIONS.map((definition) => {
		const slug = datasetSlug(definition.type);
		const countries =
			definition.coverageCountries ??
			sourceSummaries(catalogue, [slug]).flatMap(
				(source) => source.countries,
			);
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
		const docs = DATA_PAGES.find((page) => page.datasets.includes(slug));
		return {
			slug,
			...DATASET_GUIDES[slug],
			source: definition.source,
			geography: definition.boundaryType,
			geographyTitle:
				GEOGRAPHIES[definition.boundaryType]?.title ??
				definition.boundaryType,
			coverage: countries.length > 0 ? nationList(countries) : null,
			maps,
			docsHref: docs ? dataPageHref(docs.slug) : null,
		};
	});
}

export function datasetsByTopic(entries: DatasetEntry[]) {
	return DATASET_TOPICS.map((topic) => ({
		...topic,
		datasets: entries
			.filter((entry) => entry.topic === topic.id)
			.sort((a, b) => a.source.name.localeCompare(b.source.name)),
	}));
}

export function boundaryEntries(catalogue: Catalogue = loadCatalogue()) {
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
			datasets: datasets.filter((dataset) => dataset.geography === id),
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
