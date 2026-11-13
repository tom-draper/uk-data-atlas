import {
	DATASET_FOUNDATION_PARTS,
	DATASET_THEMES,
	topicsOfTheme,
	moduleOfTopic,
	type DatasetModule,
} from "@uk-data-atlas/datasets/registry";
import { taxonomyOfDataset } from "./datasetTaxonomy";

/**
 * The registry's themes and modules as `/v1/themes` and `/v1/modules` serve
 * them. Labels, descriptions and order are the registry's; the counts are of
 * the datasets this API publishes.
 */

type Counted = ReadonlyArray<{ id: string }>;

const countBy = (datasets: Counted, key: "theme" | "topic" | "module") => {
	const counts = new Map<string, number>();
	for (const { id } of datasets) {
		const value = taxonomyOfDataset(id)?.[key];
		if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
	}
	return (value: string) => counts.get(value) ?? 0;
};

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
				...new Set(topics.map((topic) => moduleOfTopic(topic.id))),
			],
			datasetCount: byTheme(theme.id),
			links: { datasets: datasetsHref("theme", theme.id) },
			topics: topics.map((topic) => ({
				id: topic.id,
				label: topic.label,
				description: topic.description,
				module: moduleOfTopic(topic.id),
				datasetCount: byTopic(topic.id),
				links: { datasets: datasetsHref("topic", topic.id) },
			})),
		};
	});
};

export const describeModules = (datasets: Counted) => {
	const byModule = countBy(datasets, "module");
	const themeModules = new Map<DatasetModule, string[]>();
	for (const theme of DATASET_THEMES)
		for (const topic of topicsOfTheme(theme.id)) {
			const module = moduleOfTopic(topic.id);
			themeModules.set(module, [
				...new Set([...(themeModules.get(module) ?? []), theme.id]),
			]);
		}
	return [
		...[...themeModules].map(([id, themes]) => {
			const owned = DATASET_THEMES.filter((theme) =>
				themes.includes(theme.id),
			);
			return {
				id,
				kind: "theme" as const,
				label: owned.map((theme) => theme.label).join(", "),
				description: owned.map((theme) => theme.description).join(" "),
				themes,
				topics: owned.flatMap((theme) =>
					topicsOfTheme(theme.id)
						.filter((topic) => moduleOfTopic(topic.id) === id)
						.map((topic) => ({
							id: topic.id,
							label: topic.label,
							theme: theme.id,
						})),
				),
				datasetCount: byModule(id),
				links: { datasets: datasetsHref("module", id) },
			};
		}),
		...DATASET_FOUNDATION_PARTS.map((part) => ({
			id: part.id,
			kind: "foundation" as const,
			label: part.label,
			description: part.description,
			themes: [] as string[],
			topics: [] as Array<{ id: string; label: string; theme: string }>,
			datasetCount: byModule(part.id),
		})),
	];
};
