import { DATASET_GUIDES, type DatasetGuide } from "./guides.ts";
import {
	DATASET_THEMES,
	DATASET_TOPICS,
	type DatasetThemeInfo,
	type DatasetTopicInfo,
	type DatasetTheme,
	type DatasetTopic,
} from "./taxonomy.ts";

/**
 * The datasets under their themes and topics, in registry order. The docs,
 * `/datasets`, `llms.txt` and the API docs all group datasets from here, so
 * none keeps a list of its own. Themes and topics follow the taxonomy;
 * datasets within a topic follow their titles.
 */

/** A dataset with the theme its topic belongs to. */
export interface RegisteredDataset extends DatasetGuide {
	id: string;
	theme: DatasetTheme;
}

export interface DatasetTopicBranch {
	topic: DatasetTopicInfo;
	datasets: readonly RegisteredDataset[];
}

export interface DatasetThemeBranch {
	theme: DatasetThemeInfo;
	topics: readonly DatasetTopicBranch[];
}

const topicTheme = new Map(DATASET_TOPICS.map((t) => [t.id, t.theme]));

const REGISTERED: readonly RegisteredDataset[] = Object.entries(DATASET_GUIDES)
	.map(([id, guide]) => ({
		id,
		...guide,
		theme: topicTheme.get(guide.topic) as DatasetTheme,
	}))
	.sort((a, b) => a.title.localeCompare(b.title, "en"));

/** Every dataset, by theme and topic order, then title. */
export const REGISTERED_DATASETS: readonly RegisteredDataset[] =
	DATASET_THEMES.flatMap(({ id: theme }) =>
		DATASET_TOPICS.filter((topic) => topic.theme === theme).flatMap(
			(topic) =>
				REGISTERED.filter((dataset) => dataset.topic === topic.id),
		),
	);

export const DATASET_TREE: readonly DatasetThemeBranch[] = DATASET_THEMES.map(
	(theme) => ({
		theme,
		topics: DATASET_TOPICS.filter((topic) => topic.theme === theme.id).map(
			(topic) => ({
				topic,
				datasets: REGISTERED_DATASETS.filter(
					(dataset) => dataset.topic === topic.id,
				),
			}),
		),
	}),
);

export const getRegisteredDataset = (
	id: string,
): RegisteredDataset | undefined =>
	REGISTERED_DATASETS.find((dataset) => dataset.id === id);

export const datasetsOfTopic = (
	topic: DatasetTopic,
): readonly RegisteredDataset[] =>
	REGISTERED_DATASETS.filter((dataset) => dataset.topic === topic);

export const datasetsOfTheme = (
	theme: DatasetTheme,
): readonly RegisteredDataset[] =>
	REGISTERED_DATASETS.filter((dataset) => dataset.theme === theme);
