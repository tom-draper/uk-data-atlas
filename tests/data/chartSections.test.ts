import { DATASET_THEMES, topicsOfTheme } from "@uk-data-atlas/datasets";
import { CHART_DATASET_DEFINITIONS, datasetSlug } from "@/lib/datasets";
import {
	CHART_SECTIONS,
	DEFAULT_CHARTS_BY_THEME,
	compareChartsByTopic,
	themeOfChart,
} from "@/lib/datasets/chartSections";
import { getChartDefinitions } from "@/lib/datasets/types";
import { buildSettingsSections } from "@/lib/datasets/chartSettingsSections";
import {
	CHART_CONFIG,
	DEFAULT_VISIBILITY,
} from "@/lib/context/ChartVisibilityContext";
import { DATASETS } from "./datasetUniverse";

/**
 * The website's chart sections come from the registry (docs/data-organisation.md,
 * task 4). These tests keep a card's topic the same as its dataset's topic, so
 * the section a card shows in cannot drift from where its dataset is filed.
 */

const topicOfDataset = new Map(DATASETS.map(({ id, topic }) => [id, topic]));

describe("website chart sections", () => {
	it("has one section per theme, in theme order", () => {
		expect(CHART_SECTIONS.map(({ theme }) => theme)).toEqual(
			DATASET_THEMES.map(({ id }) => id),
		);
	});

	it("files every card under the topic of its dataset", () => {
		const wrong = CHART_DATASET_DEFINITIONS.flatMap((definition) =>
			getChartDefinitions(definition)
				.filter(
					(chart) =>
						topicOfDataset.get(datasetSlug(definition.type)) !==
						chart.topic,
				)
				.map(
					(chart) =>
						`${chart.key}: card ${chart.topic}, dataset ${topicOfDataset.get(datasetSlug(definition.type))}`,
				),
		);
		expect(wrong).toEqual([]);
	});

	it("gives every section at least one card", () => {
		const themes = new Set(
			CHART_DATASET_DEFINITIONS.flatMap((definition) =>
				getChartDefinitions(definition).map(themeOfChart),
			),
		);
		expect(
			CHART_SECTIONS.filter(({ theme }) => !themes.has(theme)),
		).toEqual([]);
	});

	it("orders cards by their topic's order within a theme", () => {
		for (const { id: theme } of DATASET_THEMES) {
			const topics = topicsOfTheme(theme).map(({ id }) => id);
			const cards = CHART_DATASET_DEFINITIONS.flatMap((definition) =>
				getChartDefinitions(definition).filter(
					(chart) => themeOfChart(chart) === theme,
				),
			).sort(compareChartsByTopic);
			const positions = cards.map(({ topic }) => topics.indexOf(topic));
			expect(positions).toEqual([...positions].sort((a, b) => a - b));
		}
	});

	describe("default cards", () => {
		const charts = CHART_DATASET_DEFINITIONS.flatMap((definition) =>
			getChartDefinitions(definition),
		);

		it("name real cards, each under its own theme", () => {
			for (const [theme, keys] of Object.entries(
				DEFAULT_CHARTS_BY_THEME,
			)) {
				for (const key of keys) {
					const chart = charts.find(
						(candidate) => candidate.key === key,
					);
					expect(chart, `${theme}: ${key}`).toBeDefined();
					expect(themeOfChart(chart!), key).toBe(theme);
				}
			}
		});

		it("keep to one to five cards per theme, with none repeated", () => {
			const all = Object.values(DEFAULT_CHARTS_BY_THEME).flat();
			expect(new Set(all).size).toBe(all.length);
			for (const { theme } of CHART_SECTIONS) {
				const count = DEFAULT_CHARTS_BY_THEME[theme].length;
				expect(count, theme).toBeGreaterThanOrEqual(1);
				expect(count, theme).toBeLessThanOrEqual(5);
			}
		});
	});

	describe("settings panel", () => {
		const sections = buildSettingsSections(CHART_CONFIG);
		const topics = sections.flatMap((section) => section.topics);

		it("lists every card once under its own topic", () => {
			const own = topics.flatMap(({ items }) => items.map((i) => i.key));
			expect(own.sort()).toEqual(CHART_CONFIG.map((c) => c.key).sort());
		});

		it("lists a related card under each related topic, as the same card", () => {
			const related = CHART_CONFIG.filter((c) => c.related.length > 0);
			expect(related.length).toBeGreaterThan(0);
			const listed = topics.flatMap((t) => t.related.map((r) => r.key));
			expect(listed.sort()).toEqual(
				related.flatMap((c) => c.related.map(() => c.key)).sort(),
			);
			for (const { key } of related)
				expect(
					Object.keys(DEFAULT_VISIBILITY).filter((k) => k === key),
				).toHaveLength(1);
		});

		it("never repeats a card under its own topic, nor changes the defaults", () => {
			for (const topic of topics) {
				const own = new Set(topic.items.map(({ key }) => key));
				expect(topic.related.filter(({ key }) => own.has(key))).toEqual(
					[],
				);
			}
			const defaults = Object.values(DEFAULT_CHARTS_BY_THEME).flat();
			expect(
				Object.keys(DEFAULT_VISIBILITY)
					.filter((key) => DEFAULT_VISIBILITY[key])
					.sort(),
			).toEqual([...defaults].sort());
		});
	});
});
