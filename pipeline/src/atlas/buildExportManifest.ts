import { statisticsReadPathPath } from "@uk-data-atlas/atlas-db";

import {
	readMeasureDimensionsConfig,
	type StatisticsReadPath,
} from "@uk-data-atlas/measures";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DataCatalog } from "@uk-data-atlas/measures";
import { compileExportManifest } from "./exportManifest.ts";
import { artifactDirectory } from "@uk-data-atlas/atlas-db";
import { DatabaseSync } from "node:sqlite";
import { sha256 } from "@uk-data-atlas/artifacts";
import { measureStatisticsSelections } from "../statistics/measureStatisticsSelections.ts";
import { compileMeasureDownloads } from "../statistics/measureDownloads.ts";
import type { CompiledMeasure } from "../catalog/manifest.ts";
import { statisticsArtifactReader } from "../statistics/statisticsArtifacts.ts";
import { readJsonSync } from "../lib/json.ts";

export const buildExportManifest = async (repositoryRoot: string) => {
	const publicDirectory = artifactDirectory(repositoryRoot);
	const dataCatalogPath = join(publicDirectory, "data-catalog.json");
	const dataCatalog = readJsonSync(dataCatalogPath) as DataCatalog;
	const bindings = readJsonSync(
		join(repositoryRoot, "data/build/measure-statistics-fields.json"),
	) as Array<{
		measureId: string;
		field: NonNullable<CompiledMeasure["statisticsField"]>;
	}>;
	const readPath = readJsonSync(
		statisticsReadPathPath(repositoryRoot),
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
