import { observationArtifactName } from "@uk-data-atlas/measures";
import { buildArtifactPath } from "@uk-data-atlas/areas";
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { validateAnalysisGeographies } from "@uk-data-atlas/catalogue/node";
import type { AnalysisGeographyInventory } from "@uk-data-atlas/relationships";
import type { CrosswalkInventory } from "@uk-data-atlas/relationships";
import type {
	AnyMeasureObservationArtifact,
	DataCatalog,
} from "@uk-data-atlas/catalogue/node";
import type { MeasureTableArtifact } from "@uk-data-atlas/catalogue/node";
import { createCrosswalkArtifacts } from "./storage/crosswalkArtifacts.ts";
import { artifactDirectory } from "@uk-data-atlas/atlas-db";
import { openStatisticsArtifactReader } from "./statistics/statisticsArtifacts.ts";
import { readJsonSync } from "./lib/json.ts";

export const buildAnalysisGeographyValidation = (repositoryRoot: string) => {
	const directory = artifactDirectory(repositoryRoot);
	const required = [
		"analysis-geographies.json",
		"data-catalog.json",
		"crosswalk-inventory.json",
	];
	if (
		required.some(
			(name) => !existsSync(buildArtifactPath(repositoryRoot, name)),
		)
	)
		throw new Error(
			"Build analysis geographies, the data catalogue and crosswalk inventory before analysis validation.",
		);
	const analysisGeographies = readJsonSync(
		buildArtifactPath(repositoryRoot, "analysis-geographies.json"),
	) as AnalysisGeographyInventory;
	const dataCatalog = readJsonSync(
		join(directory, "data-catalog.json"),
	) as DataCatalog;
	const crosswalkInventory = readJsonSync(
		join(directory, "crosswalk-inventory.json"),
	) as CrosswalkInventory;
	// Only the crosswalks the configured pairs route through are read.
	const crosswalkLookup = createCrosswalkArtifacts(
		directory,
		crosswalkInventory,
	);
	const { database, readArtifact } = openStatisticsArtifactReader(
		repositoryRoot,
		dataCatalog,
	);
	try {
		const observations = new Map<
			string,
			AnyMeasureObservationArtifact | MeasureTableArtifact
		>();
		for (const measure of dataCatalog.measures)
			for (const source of measure.sources) {
				const name = observationArtifactName(measure.id, source);
				if (!observations.has(name))
					observations.set(
						name,
						JSON.parse(readArtifact(measure.id, source)) as
							| AnyMeasureObservationArtifact
							| MeasureTableArtifact,
					);
			}
		const inventory = validateAnalysisGeographies(
			analysisGeographies,
			dataCatalog,
			crosswalkLookup,
			observations,
		);
		const outputPath = buildArtifactPath(
			repositoryRoot,
			"analysis-geography-validation.json",
		);
		mkdirSync(dirname(outputPath), { recursive: true });
		writeFileSync(outputPath, `${JSON.stringify(inventory, null, "\t")}\n`);
		return { outputPath, count: inventory.supports.length };
	} finally {
		database.close();
	}
};
