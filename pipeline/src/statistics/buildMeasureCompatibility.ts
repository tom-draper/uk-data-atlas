import { buildArtifactPath } from "@uk-data-atlas/areas";
import {
	isMeasureTable,
	type AnyMeasureObservationArtifact,
} from "@uk-data-atlas/catalogue/node";
import { tableMeasureObservations } from "@uk-data-atlas/measures";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AreaInventory, AreaReleaseArtifact } from "@uk-data-atlas/areas";
import type { BoundaryRegistry } from "@uk-data-atlas/catalogue";
import { type DataCatalog } from "@uk-data-atlas/catalogue/node";
import { compileMeasureCompatibility } from "./measureCompatibility.ts";
import { artifactDirectory } from "@uk-data-atlas/atlas-db";
import { openStatisticsArtifactReader } from "./statisticsArtifacts.ts";
import { readJsonSync } from "../lib/json.ts";

const read = <T>(path: string): T => readJsonSync(path) as T;

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
	const { database, readArtifact } = openStatisticsArtifactReader(
		repositoryRoot,
		dataCatalog,
	);
	try {
		const compatibility = compileMeasureCompatibility(
			dataCatalog,
			read<BoundaryRegistry>(
				buildArtifactPath(repositoryRoot, "boundary-releases.json"),
			),
			artifacts,
			dataCatalog.measures.flatMap((measure) =>
				measure.sources.map((source) => {
					const artifact: unknown = JSON.parse(
						readArtifact(measure.id, source),
					);
					return isMeasureTable(artifact)
						? tableMeasureObservations(artifact, measure.id)
						: (artifact as AnyMeasureObservationArtifact);
				}),
			),
		);
		const outputPath = join(publicDirectory, "measure-compatibility.json");
		writeFileSync(
			outputPath,
			`${JSON.stringify(compatibility, null, "\t")}\n`,
		);
		return { outputPath, measureCount: compatibility.measures.length };
	} finally {
		database.close();
	}
};
