import {
	readSourceObservations,
	type MeasureTableArtifact,
} from "../src/observationTables";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AreaInventory, AreaReleaseArtifact } from "../src/areaInventory";
import type { BoundaryRegistry } from "../src/boundaryRegistry";
import { type DataCatalog, observationArtifactName } from "../src/dataCatalog";
import { compileMeasureCompatibility } from "../src/measureCompatibility";

const read = <T>(path: string): T =>
	JSON.parse(readFileSync(path, "utf8")) as T;

export const buildMeasureCompatibility = (repositoryRoot: string) => {
	const publicDirectory = join(repositoryRoot, "services", "api", "public");
	const required = [
		"data-catalog.json",
		"boundary-releases.json",
		"area-inventory.json",
	];
	for (const file of required) {
		if (!existsSync(join(publicDirectory, file))) {
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
	// A table serves several measures, so it is read once.
	const tables = new Map<string, MeasureTableArtifact>();
	const compatibility = compileMeasureCompatibility(
		dataCatalog,
		read<BoundaryRegistry>(join(publicDirectory, "boundary-releases.json")),
		artifacts,
		dataCatalog.measures.flatMap((measure) =>
			measure.sources.map((source) =>
				readSourceObservations(
					publicDirectory,
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
	const repositoryRoot = resolve(dirname(scriptPath), "../../..");
	const result = buildMeasureCompatibility(repositoryRoot);
	console.log(
		`Wrote compatibility for ${result.measureCount} measures to ${result.outputPath}`,
	);
}
