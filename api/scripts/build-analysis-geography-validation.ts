import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateAnalysisGeographies } from "../src/analysisGeographyValidation";
import type { AnalysisGeographyInventory } from "../src/analysisGeographies";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "../src/crosswalkInventory";
import type {
	AnyMeasureObservationArtifact,
	DataCatalog,
} from "../src/dataCatalog";
import type { MeasureTableArtifact } from "../src/observationTables";

export const buildAnalysisGeographyValidation = (repositoryRoot: string) => {
	const directory = join(repositoryRoot, "api", "public");
	const required = [
		"analysis-geographies.json",
		"data-catalog.json",
		"crosswalk-inventory.json",
	];
	if (required.some((name) => !existsSync(join(directory, name))))
		throw new Error(
			"Build analysis geographies, the data catalogue and crosswalk inventory before analysis validation.",
		);
	const analysisGeographies = JSON.parse(
		readFileSync(join(directory, "analysis-geographies.json"), "utf8"),
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
				readFileSync(join(directory, entry.artifact), "utf8"),
			) as CrosswalkArtifact;
			return [entry.id, artifact] as const;
		}),
	);
	const observations = new Map(
		dataCatalog.measures.flatMap((measure) =>
			measure.sources.flatMap((source) => {
				const artifact =
					source.observationArtifact ?? `${measure.id}-observations`;
				const path = join(directory, `${artifact}.json`);
				if (!existsSync(path)) return [];
				// A table is kept whole: the validator reads each measure's
				// column from it, since several measures share the one name.
				return [
					[
						artifact,
						JSON.parse(readFileSync(path, "utf8")) as
							| AnyMeasureObservationArtifact
							| MeasureTableArtifact,
					] as const,
				];
			}),
		),
	);
	const inventory = validateAnalysisGeographies(
		analysisGeographies,
		dataCatalog,
		crosswalkLookup,
		observations,
	);
	const outputPath = join(directory, "analysis-geography-validation.json");
	writeFileSync(outputPath, `${JSON.stringify(inventory, null, "\t")}\n`);
	return { outputPath, count: inventory.supports.length };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const result = buildAnalysisGeographyValidation(
		resolve(dirname(scriptPath), "../.."),
	);
	console.log(
		`Validated ${result.count} analysis geography support entries at ${result.outputPath}`,
	);
}
