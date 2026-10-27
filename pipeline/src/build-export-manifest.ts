import {
	observationDatabasePath,
	assertObservationCatalogue,
} from "../../shared/atlasObservations";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { DataCatalog } from "../../shared/dataCatalog";
import { compileExportManifest } from "./exportManifest";

export const buildExportManifest = (repositoryRoot: string) => {
	const publicDirectory = join(repositoryRoot, "services", "api", "public");
	const dataCatalogPath = join(publicDirectory, "data-catalog.json");
	const dataCatalog = JSON.parse(
		readFileSync(dataCatalogPath, "utf8"),
	) as DataCatalog;
	const databasePath = observationDatabasePath(
		resolve(repositoryRoot, "services/api"),
	);
	assertObservationCatalogue(databasePath, dataCatalog);
	const manifest = compileExportManifest(
		publicDirectory,
		dataCatalog,
		databasePath,
	);
	const outputPath = join(publicDirectory, "export-manifest.json");
	writeFileSync(outputPath, `${JSON.stringify(manifest, null, "\t")}\n`);
	return { outputPath, exportCount: manifest.exports.length };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = buildExportManifest(repositoryRoot);
	console.log(
		`Wrote ${result.exportCount} bulk exports to ${result.outputPath}`,
	);
}
