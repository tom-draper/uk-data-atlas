import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AreaInventory, AreaReleaseArtifact } from "../src/areaInventory";
import type { BoundaryRegistry } from "../src/boundaryRegistry";
import {
	type DataCatalog,
	isLegacyPopulationSource,
	type MeasureObservationArtifact,
	observationArtifactName,
	PopulationLocalAuthorityObservationArtifact,
	PopulationObservationArtifact,
} from "../src/dataCatalog";
import { compileMeasureCompatibility } from "../src/measureCompatibility";

const read = <T>(path: string): T =>
	JSON.parse(readFileSync(path, "utf8")) as T;

export const buildMeasureCompatibility = (repositoryRoot: string) => {
	const publicDirectory = join(repositoryRoot, "api", "public");
	const required = [
		"data-catalog.json",
		"boundary-releases.json",
		"area-inventory.json",
		"population-observations.json",
		"population-local-authority-observations.json",
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
	const compatibility = compileMeasureCompatibility(
		dataCatalog,
		read<BoundaryRegistry>(join(publicDirectory, "boundary-releases.json")),
		artifacts,
		read<PopulationObservationArtifact>(
			join(publicDirectory, "population-observations.json"),
		),
		read<PopulationLocalAuthorityObservationArtifact>(
			join(
				publicDirectory,
				"population-local-authority-observations.json",
			),
		),
		dataCatalog.measures.flatMap((measure) =>
			measure.sources
				.filter((source) => !isLegacyPopulationSource(measure.id, source))
				.map((source) =>
					read<MeasureObservationArtifact>(
						join(
							publicDirectory,
							`${observationArtifactName(measure.id, source)}.json`,
						),
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
