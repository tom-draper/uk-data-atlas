import { CATALOGUE_DATASET_DEFINITIONS } from "./registry";
import type { DatasetSource } from "./types";

/** Sources for boundary geometry, which is not itself a value dataset. */
const BOUNDARY_SOURCES: readonly DatasetSource[] = [
	{
		name: "Westminster Parliamentary Wards (Boundaries)",
		source: "ONS Open Geography Portal",
		sourceUrl: "https://geoportal.statistics.gov.uk/",
		year: "2016–2026",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description: "Electoral ward boundaries.",
	},
	{
		name: "Local Authority Districts (Boundaries)",
		source: "ONS Open Geography Portal",
		sourceUrl: "https://geoportal.statistics.gov.uk/",
		year: "2016–2025",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description: "Local authority district boundaries.",
	},
	{
		name: "Westminster Parliamentary Constituencies (Boundaries)",
		source: "ONS Open Geography Portal",
		sourceUrl: "https://geoportal.statistics.gov.uk/",
		year: "2015, 2016, 2017, 2019, 2024",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description: "Parliamentary constituency boundaries.",
	},
];

/** The shared source list for the app’s Sources page and the GitHub README. */
export const DATASET_SOURCES: readonly DatasetSource[] = [
	...CATALOGUE_DATASET_DEFINITIONS.map((definition) => definition.source),
	...BOUNDARY_SOURCES,
];

const markdownCell = (value: string) => value.replaceAll("|", "\\|");

/** Renders the README table from the same records displayed in the app. */
export function datasetSourcesMarkdown(): string {
	return [
		"| Dataset | Source | Year | Licence | Description |",
		"| --- | --- | --- | --- | --- |",
		...DATASET_SOURCES.map(
			({
				name,
				source,
				sourceUrl,
				year,
				licence,
				licenceUrl,
				description,
			}) =>
				`| **${markdownCell(name)}** | [${markdownCell(source)}](${sourceUrl}) | ${markdownCell(year)} | [${markdownCell(licence)}](${licenceUrl}) | ${markdownCell(description)} |`,
		),
	].join("\n");
}
