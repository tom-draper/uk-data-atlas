import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
	compileAnalysisGeographies,
	readAnalysisGeographySupport,
} from "../src/analysisGeographies";
import type { CrosswalkInventory } from "../src/crosswalkInventory";
import type { DataCatalog } from "../src/dataCatalog";

export const buildAnalysisGeographies = (repositoryRoot: string) => {
	const directory = join(repositoryRoot, "api", "public");
	const catalogPath = join(directory, "data-catalog.json");
	const crosswalkPath = join(directory, "crosswalk-inventory.json");
	if (!existsSync(catalogPath) || !existsSync(crosswalkPath))
		throw new Error("Build the data catalogue and crosswalk inventory before analysis geographies.");
	const inventory = compileAnalysisGeographies(
		readAnalysisGeographySupport(
			join(repositoryRoot, "api", "config", "analysis-geographies.json"),
		),
		JSON.parse(readFileSync(catalogPath, "utf8")) as DataCatalog,
		JSON.parse(readFileSync(crosswalkPath, "utf8")) as CrosswalkInventory,
	);
	const outputPath = join(directory, "analysis-geographies.json");
	writeFileSync(outputPath, `${JSON.stringify(inventory, null, "\t")}\n`);
	return { outputPath, count: inventory.supports.length };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const result = buildAnalysisGeographies(resolve(dirname(scriptPath), "../.."));
	console.log(`Wrote ${result.count} analysis geography support entries to ${result.outputPath}`);
}
