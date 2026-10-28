import {
	assertObservationCatalogue,
	observationDatabasePath,
	readObservationText,
} from "@uk-data-atlas/atlas-runtime/storage";
import { observationArtifactName } from "@uk-data-atlas/atlas-runtime/catalogue";
import { buildArtifactPath } from "@uk-data-atlas/atlas-runtime/areas";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { validateAnalysisGeographies } from "@uk-data-atlas/atlas-runtime/areas";
import type { AnalysisGeographyInventory } from "@uk-data-atlas/atlas-runtime/areas";
import type { CrosswalkArtifact } from "@uk-data-atlas/atlas-runtime/relationships";
import type { CrosswalkInventory } from "@uk-data-atlas/atlas-runtime/relationships";
import type {
	AnyMeasureObservationArtifact,
	DataCatalog,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import type { MeasureTableArtifact } from "@uk-data-atlas/atlas-runtime/catalogue";
import { readStoredText } from "@uk-data-atlas/artifacts";
import {
	apiRootOf,
	artifactDirectory,
} from "@uk-data-atlas/atlas-runtime/storage";

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
	const analysisGeographies = JSON.parse(
		readFileSync(
			buildArtifactPath(repositoryRoot, "analysis-geographies.json"),
			"utf8",
		),
	) as AnalysisGeographyInventory;
	const dataCatalog = JSON.parse(
		readFileSync(join(directory, "data-catalog.json"), "utf8"),
	) as DataCatalog;
	const crosswalkInventory = JSON.parse(
		readFileSync(join(directory, "crosswalk-inventory.json"), "utf8"),
	) as CrosswalkInventory;
	const crosswalkLookup = new Map(
		crosswalkInventory.crosswalks.map((entry) => {
			const artifact = JSON.parse(
				readStoredText(join(directory, entry.artifact)),
			) as CrosswalkArtifact;
			return [entry.id, artifact] as const;
		}),
	);
	const databasePath = observationDatabasePath(apiRootOf(repositoryRoot));
	assertObservationCatalogue(databasePath, dataCatalog);
	const names = new Set(
		dataCatalog.measures.flatMap((measure) =>
			measure.sources.map((source) =>
				observationArtifactName(measure.id, source),
			),
		),
	);
	// Shared tables remain whole so validation can read each measure's column.
	const observations = new Map(
		[...names].map((id) => [
			id,
			JSON.parse(readObservationText(databasePath, id)) as
				AnyMeasureObservationArtifact | MeasureTableArtifact,
		]),
	);
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
};
