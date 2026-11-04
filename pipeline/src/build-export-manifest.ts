import {
	statisticsReadPathPath,
	type StatisticsReadPath,
} from "@uk-data-atlas/atlas-runtime/storage";
import { readMeasureDimensionsConfig } from "@uk-data-atlas/atlas-runtime/catalogue";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { DataCatalog } from "@uk-data-atlas/measures";
import { compileExportManifest } from "./atlas/exportManifest.ts";
import { artifactDirectory } from "@uk-data-atlas/atlas-runtime/storage";
import { DatabaseSync } from "node:sqlite";
import { sha256 } from "@uk-data-atlas/artifacts";
import { measureStatisticsSelections } from "./statistics/measureStatisticsSelections.ts";
import { compileMeasureDownloads } from "./statistics/measureDownloads.ts";
import type { CompiledMeasure } from "./catalog/manifest.ts";
import { statisticsArtifactReader } from "./statistics/statisticsArtifacts.ts";

export const buildExportManifest = async (repositoryRoot: string) => {
	const publicDirectory = artifactDirectory(repositoryRoot);
	const dataCatalogPath = join(publicDirectory, "data-catalog.json");
	const dataCatalog = JSON.parse(
		readFileSync(dataCatalogPath, "utf8"),
	) as DataCatalog;
	const bindings = JSON.parse(
		readFileSync(
			join(repositoryRoot, "data/build/measure-statistics-fields.json"),
			"utf8",
		),
	) as Array<{
		measureId: string;
		field: NonNullable<CompiledMeasure["statisticsField"]>;
	}>;
	const readPath = JSON.parse(
		readFileSync(statisticsReadPathPath(repositoryRoot), "utf8"),
	) as StatisticsReadPath;
	const { ids } = readMeasureDimensionsConfig(repositoryRoot).config;
	const database = new DatabaseSync(
		join(repositoryRoot, "data/build/atlas-base.sqlite"),
		{ readOnly: true },
	);
	try {
		const manifest = compileExportManifest(
			publicDirectory,
			dataCatalog,
			statisticsArtifactReader(database, dataCatalog, readPath),
		);
		manifest.measureExports = [];
		for (const measure of dataCatalog.measures) {
			const selection = measureStatisticsSelections(
				database,
				measure,
				bindings,
				readPath,
				ids,
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
		const { contentHash: _previousHash, ...content } = manifest;
		manifest.contentHash = sha256(JSON.stringify(content));
		const outputPath = join(publicDirectory, "export-manifest.json");
		writeFileSync(outputPath, `${JSON.stringify(manifest, null, "\t")}\n`);
		return { outputPath, exportCount: manifest.exports.length };
	} finally {
		database.close();
	}
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = await buildExportManifest(repositoryRoot);
	console.log(
		`Wrote ${result.exportCount} bulk exports to ${result.outputPath}`,
	);
}
