import { DATASET_THEMES, topicsOfTheme } from "@uk-data-atlas/datasets";
import { CHART_DATASET_DEFINITIONS, datasetSlug } from "@/lib/datasets";
import {
	CHART_SECTIONS,
	DEFAULT_CHARTS_BY_THEME,
	compareChartsByTopic,
	themeOfChart,
} from "@/lib/datasets/chartSections";
import { getChartDefinitions } from "@/lib/datasets/types";
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
});
