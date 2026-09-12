import { existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileNamedLocations } from "../src/namedLocations";

export const buildNamedLocations = (repositoryRoot: string) => {
	const source = join(
		repositoryRoot,
		"data",
		"precompiled",
		"gazetteer.core.json",
	);
	if (!existsSync(source)) {
		throw new Error(
			`Build the gazetteer core before named locations: ${source}`,
		);
	}
	const outputPath = join(
		repositoryRoot,
		"api",
		"public",
		"named-locations.json",
	);
	const inventory = compileNamedLocations(source);
	writeFileSync(outputPath, `${JSON.stringify(inventory, null, "\t")}\n`);
	return { outputPath, count: inventory.locations.length };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = buildNamedLocations(repositoryRoot);
	console.log(
		`Wrote ${result.count} named locations to ${result.outputPath}`,
	);
}
