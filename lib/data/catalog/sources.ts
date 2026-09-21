import { CATALOGUE_DATASET_DEFINITIONS } from "./registry";
import { BOUNDARY_CATALOG } from "../boundaries/catalog";
import { GEOGRAPHIES } from "../../docs/content/geographies";
import type { DatasetSource } from "./types";

/** The shared source list for the app’s Sources page and the GitHub README. */
export const DATASET_SOURCES: readonly DatasetSource[] = [
	...CATALOGUE_DATASET_DEFINITIONS.map((definition) => definition.source),
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

/** Renders every supported boundary geography and release for the README. */
export function boundaryCoverageMarkdown(): string {
	return [
		"| Geography | Releases | Release IDs |",
		"| --- | ---: | --- |",
		...Object.entries(GEOGRAPHIES).map(([id, geography]) => {
			const releases =
				BOUNDARY_CATALOG[id as keyof typeof BOUNDARY_CATALOG].releases;
			return `| [${geography.title}](https://ukdataatlas.com/docs/v1/geographies/${geography.slug}) | ${releases.length} | ${releases.map((release) => `\`${release.id}\``).join(", ")} |`;
		}),
	].join("\n");
}
