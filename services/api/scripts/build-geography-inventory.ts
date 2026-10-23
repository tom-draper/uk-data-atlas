import { buildArtifactPath } from "./geography-build-path";
import {
	mkdirSync,
	existsSync,
	readFileSync,
	writeFileSync,
	rmSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createBoundaryRegistry } from "./build-boundary-registry";
import { createGeographyInventory } from "../src/geographyInventory";
import { createSourceInventory } from "../src/sourceInventory";
import type { AreaInventory } from "../src/areaInventory";
import type { CrosswalkInventory } from "../src/crosswalkInventory";

export const buildGeographyInventory = (repositoryRoot: string) => {
	const outputDirectory = join(repositoryRoot, "services", "api", "public");
	if (!existsSync(outputDirectory)) {
		throw new Error(
			`Create the API public directory before building: ${outputDirectory}`,
		);
	}
	const sourceInventory = createSourceInventory(repositoryRoot);
	const areaInventoryPath = join(outputDirectory, "area-inventory.json");
	const areaInventory = existsSync(areaInventoryPath)
		? (JSON.parse(readFileSync(areaInventoryPath, "utf8")) as AreaInventory)
		: undefined;
	const crosswalkInventoryPath = join(
		outputDirectory,
		"crosswalk-inventory.json",
	);
	const crosswalkInventory = existsSync(crosswalkInventoryPath)
		? (JSON.parse(
				readFileSync(crosswalkInventoryPath, "utf8"),
			) as CrosswalkInventory)
		: undefined;
	const geographyInventory = createGeographyInventory(
		createBoundaryRegistry(repositoryRoot),
		sourceInventory,
		areaInventory,
		crosswalkInventory,
	);
	const geographyPath = buildArtifactPath(
		repositoryRoot,
		"geography-inventory.json",
	);
	mkdirSync(dirname(geographyPath), { recursive: true });
	writeFileSync(
		geographyPath,
		`${JSON.stringify(geographyInventory, null, "\t")}\n`,
	);
	rmSync(join(outputDirectory, "source-inventory.json"), { force: true });
	return {
		geographyPath,
		sourceCount: sourceInventory.sources.length,
		releaseCount: geographyInventory.releases.length,
	};
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../../..");
	const result = buildGeographyInventory(repositoryRoot);
	console.log(
		`Wrote ${result.sourceCount} sources and ${result.releaseCount} geography releases`,
	);
}
