import { assertObservationCatalogue } from "@uk-data-atlas/atlas-runtime/storage";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { DataCatalog } from "@uk-data-atlas/measures";
import { compileExportManifest } from "./exportManifest";
import { artifactDirectory } from "@uk-data-atlas/atlas-runtime/storage";
import { observationBuildPath } from "./observation-build-path";
import { DatabaseSync } from "node:sqlite";
import { sha256 } from "@uk-data-atlas/artifacts";
import { measureStatisticsSelections } from "./measureStatisticsSelections";
import { compileMeasureDownloads } from "./measureDownloads";
import type { CompiledMeasure } from "./catalog/manifest";

export const buildExportManifest = async (repositoryRoot: string) => {
	const publicDirectory = artifactDirectory(repositoryRoot);
	const dataCatalogPath = join(publicDirectory, "data-catalog.json");
	const dataCatalog = JSON.parse(
		readFileSync(dataCatalogPath, "utf8"),
	) as DataCatalog;
	const databasePath = observationBuildPath(repositoryRoot);
	assertObservationCatalogue(databasePath, dataCatalog);
	const manifest = compileExportManifest(
		publicDirectory,
		dataCatalog,
		databasePath,
	);
	const bindings = JSON.parse(
		readFileSync(
			join(repositoryRoot, "data/build/measure-statistics-fields.json"),
			"utf8",
		),
	) as Array<{
		measureId: string;
		field: NonNullable<CompiledMeasure["statisticsField"]>;
	}>;
	const database = new DatabaseSync(
		join(repositoryRoot, "data/build/atlas-base.sqlite"),
		{ readOnly: true },
	);
	try {
		manifest.measureExports = [];
		for (const measure of dataCatalog.measures) {
			const selection = measureStatisticsSelections(
				database,
				measure,
				bindings,
			);
			if (!selection) continue;
			const formats = await compileMeasureDownloads(
				database,
				publicDirectory,
				measure.id,
				selection,
			);
			manifest.measureExports.push({ measureId: measure.id, formats });
		}
	} finally {
		database.close();
	}
	const { contentHash: _previousHash, ...content } = manifest;
	manifest.contentHash = sha256(JSON.stringify(content));
	const outputPath = join(publicDirectory, "export-manifest.json");
	writeFileSync(outputPath, `${JSON.stringify(manifest, null, "\t")}\n`);
	return { outputPath, exportCount: manifest.exports.length };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = await buildExportManifest(repositoryRoot);
	console.log(
		`Wrote ${result.exportCount} bulk exports to ${result.outputPath}`,
	);
}
