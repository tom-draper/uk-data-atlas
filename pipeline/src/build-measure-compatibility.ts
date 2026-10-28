import {
	observationDatabasePath,
	assertObservationCatalogue,
} from "@uk-data-atlas/atlas-runtime/storage";
import { buildArtifactPath } from "@uk-data-atlas/atlas-runtime/areas";
import {
	readSourceObservations,
	type MeasureTableArtifact,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
	AreaInventory,
	AreaReleaseArtifact,
} from "@uk-data-atlas/atlas-runtime/areas";
import type { BoundaryRegistry } from "@uk-data-atlas/catalogue";
import {
	type DataCatalog,
	observationArtifactName,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import { compileMeasureCompatibility } from "./measureCompatibility";
import {
	apiRootOf,
	artifactDirectory,
} from "@uk-data-atlas/atlas-runtime/storage";

const read = <T>(path: string): T =>
	JSON.parse(readFileSync(path, "utf8")) as T;

export const buildMeasureCompatibility = (repositoryRoot: string) => {
	const publicDirectory = artifactDirectory(repositoryRoot);
	const required = [
		"data-catalog.json",
		"boundary-releases.json",
		"area-inventory.json",
	];
	for (const file of required) {
		if (!existsSync(buildArtifactPath(repositoryRoot, file))) {
			throw new Error(`Build ${file} before measure compatibility.`);
		}
	}
	const inventory = read<AreaInventory>(
		join(publicDirectory, "area-inventory.json"),
	);
	const artifacts = inventory.releases.flatMap((release) => {
		if (release.status !== "available") return [];
		return [
			read<AreaReleaseArtifact>(join(publicDirectory, release.artifact)),
		];
	});
	const dataCatalog = read<DataCatalog>(
		join(publicDirectory, "data-catalog.json"),
	);
	const databasePath = observationDatabasePath(apiRootOf(repositoryRoot));
	assertObservationCatalogue(databasePath, dataCatalog);
	// A table serves several measures, so it is read once.
	const tables = new Map<string, MeasureTableArtifact>();
	const compatibility = compileMeasureCompatibility(
		dataCatalog,
		read<BoundaryRegistry>(
			buildArtifactPath(repositoryRoot, "boundary-releases.json"),
		),
		artifacts,
		dataCatalog.measures.flatMap((measure) =>
			measure.sources.map((source) =>
				readSourceObservations(
					databasePath,
					observationArtifactName(measure.id, source),
					measure.id,
					tables,
				),
			),
		),
	);
	const outputPath = join(publicDirectory, "measure-compatibility.json");
	writeFileSync(outputPath, `${JSON.stringify(compatibility, null, "\t")}\n`);
	return { outputPath, measureCount: compatibility.measures.length };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = buildMeasureCompatibility(repositoryRoot);
	console.log(
		`Wrote compatibility for ${result.measureCount} measures to ${result.outputPath}`,
	);
}
