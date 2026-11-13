import {
	getDatasetTopic,
	topicsOfTheme,
	type DatasetTopic,
} from "@uk-data-atlas/datasets";
import { CHART_SECTIONS } from "./chartSections";

/** A card as the settings panel lists it. */
export interface SettingsCard {
	key: string;
	label: string;
	source: string;
}

/** A card listed under a topic it is only related to, with where it is filed. */
export interface RelatedSettingsCard extends SettingsCard {
	/** The label of the topic the card is filed under. */
	filedUnder: string;
}

export interface SettingsTopic {
	topic: string;
	/** Cards filed under the topic. */
	items: SettingsCard[];
	/** Cards filed elsewhere that list the topic as related. */
	related: RelatedSettingsCard[];
}

export interface SettingsSection {
	title: string;
	topics: SettingsTopic[];
}

/** What the builder needs of a chart: the config entry plus its dataset's related topics. */
export interface SettingsChart extends SettingsCard {
	topic: DatasetTopic;
	related: readonly DatasetTopic[];
}

/**
 * The settings panel sections: a section per theme and a group per topic, each
 * card listed once under its primary topic. A card whose dataset lists other
 * topics as related also appears, marked as related, under those topics. It is
 * the same card with the same key and switch, so cross-listing never adds a
 * card or changes which cards show by default.
 */
export function buildSettingsSections(
	charts: readonly SettingsChart[],
): SettingsSection[] {
	return CHART_SECTIONS.flatMap(({ theme, title }) => {
		const topics = topicsOfTheme(theme).flatMap((topic) => {
			const items = charts
				.filter((chart) => chart.topic === topic.id)
				.map(({ key, label, source }) => ({ key, label, source }));
			const related = charts
				.filter((chart) => chart.related.includes(topic.id))
				.map(({ key, label, source, topic: filed }) => ({
					key,
					label,
					source,
					filedUnder: getDatasetTopic(filed).label,
				}));
			return items.length > 0 || related.length > 0
				? [{ topic: topic.label, items, related }]
				: [];
		});
		return topics.length > 0 ? [{ title, topics }] : [];
	});
}
