import {
	DATASET_THEMES,
	buildModuleManifests,
	modulesOfTopic,
	topicsOfTheme,
} from "@uk-data-atlas/datasets/registry";
import {
	datasetIsInModule,
	registryIdOfDataset,
	taxonomyOfDataset,
} from "./datasetTaxonomy";

/**
 * The registry's themes and modules as `/v1/themes` and `/v1/modules` serve
 * them. Labels, descriptions and order are the registry's; the counts are of
 * the datasets this API publishes.
 */

type Counted = ReadonlyArray<{ id: string }>;

const countBy = (datasets: Counted, key: "theme" | "topic") => {
	const counts = new Map<string, number>();
	for (const { id } of datasets) {
		const value = taxonomyOfDataset(id)?.[key];
		if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
	}
	return (value: string) => counts.get(value) ?? 0;
};

/** Datasets with rows in a module: its own, and those an add-on adds rows to. */
const countInModule = (datasets: Counted) => (module: string) =>
	datasets.filter(({ id }) =>
		datasetIsInModule(taxonomyOfDataset(id), module),
	).length;

const datasetsHref = (filter: "theme" | "topic" | "module", id: string) =>
	`/v1/datasets?${filter}=${id}`;

export const describeThemes = (datasets: Counted) => {
	const byTheme = countBy(datasets, "theme");
	const byTopic = countBy(datasets, "topic");
	return DATASET_THEMES.map((theme) => {
		const topics = topicsOfTheme(theme.id);
		return {
			id: theme.id,
			label: theme.label,
			description: theme.description,
			modules: [
				...new Set(topics.flatMap((topic) => modulesOfTopic(topic.id))),
			],
			datasetCount: byTheme(theme.id),
			links: { datasets: datasetsHref("theme", theme.id) },
			topics: topics.map((topic) => ({
				id: topic.id,
				label: topic.label,
				description: topic.description,
				module: modulesOfTopic(topic.id)[0],
				modules: modulesOfTopic(topic.id),
				datasetCount: byTopic(topic.id),
				links: { datasets: datasetsHref("topic", topic.id) },
			})),
		};
	});
};

/** A catalogue dataset, with the licence it records, if the catalogue has one. */
type Licensed = { id: string; licence?: { name: string } };

/**
 * The manifests the dist tree writes (`buildModuleManifests`), with the
 * counts of this API's datasets. The licences are the names the catalogue
 * records, read through the same resolver as the `meta.json` files the dist
 * generator reads. A foundation part has no catalogue dataset, so its
 * licences are `null`, not derived.
 */
export const describeModules = (datasets: ReadonlyArray<Licensed>) => {
	const byModule = countInModule(datasets);
	const namesOf = new Map<string, string[]>();
	for (const { id, licence } of datasets)
		if (licence)
			namesOf.set(registryIdOfDataset(id), [
				...(namesOf.get(registryIdOfDataset(id)) ?? []),
				licence.name,
			]);
	return buildModuleManifests({
		datasets: (datasetId) => namesOf.get(datasetId) ?? [],
	}).map((manifest) => ({
		id: manifest.id,
		kind: manifest.kind,
		label: manifest.label,
		description: manifest.description,
		themes: [...manifest.themes],
		topics: manifest.topics.map((topic) => ({
			id: topic.id,
			label: topic.label,
			theme: topic.theme,
			description: topic.description,
		})),
		datasetCount: byModule(manifest.id),
		...(manifest.kind === "theme"
			? { links: { datasets: datasetsHref("module", manifest.id) } }
			: {}),
		schemaVersion: manifest.schemaVersion,
		alwaysIncluded: manifest.alwaysIncluded,
		requires: [...manifest.requires],
		addOns: [...manifest.addOns],
		compatibility: manifest.compatibility,
		licences: manifest.licences,
		licenceConflict: manifest.licenceConflict,
		datasets: manifest.datasets.map((dataset) => ({
			id: dataset.id,
			title: dataset.title,
			topic: dataset.topic,
			partial: dataset.partial,
		})),
		build: manifest.build,
	}));
};
