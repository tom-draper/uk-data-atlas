import {
	DATASET_THEMES,
	DATASET_TOPICS,
	themeOfTopic,
	type DatasetTheme,
	type DatasetTopic,
} from "@uk-data-atlas/datasets";
import type { ChartDefinition } from "./types";

/**
 * The website's chart sections come from the dataset registry, not from a list
 * kept here. There is one section per theme, in theme order. Within a section
 * cards follow their topic's order, and cards of one topic keep registry order.
 * Which cards show by default is in `defaultCharts.ts`.
 */

export interface ChartSection {
	theme: DatasetTheme;
	title: string;
}

/** The sections, one per theme, in theme order. */
export const CHART_SECTIONS: readonly ChartSection[] = DATASET_THEMES.map(
	({ id, label }) => ({ theme: id, title: label }),
);

/** The theme whose section holds a card. */
export const themeOfChart = (chart: Pick<ChartDefinition, "topic">) =>
	themeOfTopic(chart.topic);

const TOPIC_POSITION: ReadonlyMap<DatasetTopic, number> = new Map(
	DATASET_TOPICS.map((topic, index) => [topic.id, index]),
);

/** Orders cards by topic position (theme order, then topic order). */
export const compareChartsByTopic = (
	left: Pick<ChartDefinition, "topic">,
	right: Pick<ChartDefinition, "topic">,
) =>
	(TOPIC_POSITION.get(left.topic) ?? 0) -
	(TOPIC_POSITION.get(right.topic) ?? 0);

/**
 * The cards shown on first load, a few per theme. Every other card is one
 * switch away in the chart settings, and a visitor's own choices win over this
 * list. Keep it short: each card shown loads its dataset. A test holds it to
 * real cards, at least one per theme and no more than five.
 */
export const DEFAULT_CHARTS_BY_THEME: Record<DatasetTheme, readonly string[]> =
	{
		population: [
			"demographics-populationDensity",
			"demographics-age",
			"demographics-gender",
			"demographics-ethnicity",
		],
		economy: [
			"economy-income",
			"economy-jobs",
			"economy-claimant-count",
			"economy-regional-gdp-itl3",
			"economy-business-activity",
		],
		housing: [
			"economics-housePrice",
			"housing-housing-affordability",
			"housing-homelessness",
		],
		health: [
			"health-lifeExpectancy",
			"health-nhs-waiting",
			"health-adult-social-care-activity",
		],
		education: ["education-school-performance", "education-qualification"],
		society: [
			"society-imd",
			"society-child-poverty",
			"economics-fuelPoverty",
			"society-crime",
		],
		politics: [
			"generalElection-2024",
			"localElection-2025",
			"brexit-electoral",
		],
		environment: [
			"environment-air-quality",
			"environment-ghg-emissions",
			"environment-electricity-consumption",
		],
		transport: [
			"transport-car-availability",
			"transport-travel-to-work",
			"transport-electric-vehicle-chargers",
		],
		infrastructure: [
			"infrastructure-broadband",
			"infrastructure-mobile-coverage",
		],
	};

export const DEFAULT_CHART_KEYS: readonly string[] = Object.values(
	DEFAULT_CHARTS_BY_THEME,
).flat();

/**
 * Cards in the chart panel that no dataset in the registry backs. They cannot
 * be placed by topic, so each is placed here by hand with its reason. A card
 * that gains a registry dataset leaves this list.
 */
export const CARDS_OUTSIDE_THE_REGISTRY = {
	/** Road safety and road network map layers, drawn by `TransportCards`. */
	transportLayers: {
		theme: "transport",
		reason: "Map layers built from road safety and network data the registry does not list as datasets.",
	},
	/** The visitor's own uploaded data, drawn by `CustomSection`. */
	customDatasets: {
		theme: null,
		reason: "Uploaded by the visitor, so it belongs to no theme. It follows the theme sections under its own heading.",
	},
} as const satisfies Record<
	string,
	{ theme: DatasetTheme | null; reason: string }
>;
