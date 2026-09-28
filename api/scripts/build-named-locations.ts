import { createHash } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileNamedLocations } from "../src/namedLocations";
import { createAreaGeometryCache } from "../src/geometryLoader";
import { readAreaInventory, readAreaLookup } from "../src/boundaryLoader";
import { compileNamedLocationGeometry } from "../src/namedLocationGeometry";

export const buildNamedLocations = (repositoryRoot: string) => {
	const source = join(
		repositoryRoot,
		"public",
		"data",
		"datasets",
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
	const parsed = compileNamedLocations(source);
	const areaInventory = readAreaInventory(join(repositoryRoot, "api"));
	const areas = readAreaLookup(join(repositoryRoot, "api"), areaInventory);
	const cache = createAreaGeometryCache(join(repositoryRoot, "api"), 1);
	const locations = parsed.locations.map((location) => {
		const release = areaInventory.releases
			.filter(
				(candidate) =>
					candidate.status === "available" &&
					candidate.geography === location.memberGeography &&
					areas
						.get(`${candidate.geography}/${candidate.id}`)
						?.has(location.memberCodes[0] ?? "") &&
					location.memberCodes.every((code) =>
						areas
							.get(`${candidate.geography}/${candidate.id}`)
							?.has(code),
					),
			)
			.sort((left, right) => right.id.localeCompare(left.id))[0];
		if (!release) return location;
		try {
			const geometry = compileNamedLocationGeometry(
				cache,
				location.memberGeography,
				release.id,
				location.memberCodes,
			);
			return geometry
				? { ...location, bbox: geometry.bbox, geometry }
				: location;
		} catch {
			return location;
		}
	});
	const content = JSON.stringify({
		schemaVersion: 1,
		source: parsed.source,
		locations,
	});
	const inventory = {
		...parsed,
		contentHash: `sha256:${createHash("sha256").update(content).digest("hex")}`,
		locations,
	};
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
