import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	readCrosswalkAdapters,
	type AreaOverlapCrosswalkAdapter,
} from "../src/crosswalkAdapters";
import {
	compileCrosswalks,
	createCrosswalkInventory,
	type AreaOverlapCrosswalkArtifact,
	type CrosswalkArtifact,
} from "../src/crosswalkInventory";
import { readGeometrySourceLookup } from "../src/geometrySources";
import {
	createAreaLookup,
	type AreaInventory,
	type AreaReleaseArtifact,
} from "../src/areaInventory";

const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

const readCompiledAreaLookup = (outputDirectory: string) => {
	const inventory = JSON.parse(
		readFileSync(join(outputDirectory, "area-inventory.json"), "utf8"),
	) as AreaInventory;
	if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.releases)) {
		throw new Error("Invalid area inventory before compiling crosswalks.");
	}
	const artifacts = inventory.releases.flatMap((release) => {
		if (release.status !== "available") return [];
		const path = join(outputDirectory, release.artifact);
		const artifact = JSON.parse(
			readFileSync(path, "utf8"),
		) as AreaReleaseArtifact;
		if (
			artifact.schemaVersion !== 1 ||
			artifact.contentHash !== release.contentHash ||
			!Array.isArray(artifact.areas)
		) {
			throw new Error(`Invalid area release artifact at ${path}`);
		}
		return [artifact];
	});
	return createAreaLookup(artifacts);
};

/**
 * Geometry overlays are deliberately expensive. A prior artifact is safe to
 * reuse only when it passes its own hash check and its declared geometry
 * inputs and numeric rules still match the current adapter.
 */
const reusableAreaOverlap = (
	outputDirectory: string,
	adapter: AreaOverlapCrosswalkAdapter,
	geometrySources: ReturnType<typeof readGeometrySourceLookup>,
): AreaOverlapCrosswalkArtifact | undefined => {
	const path = join(outputDirectory, "crosswalks", `${adapter.id}.json`);
	if (!existsSync(path)) return undefined;
	try {
		const artifact = JSON.parse(readFileSync(path, "utf8")) as CrosswalkArtifact;
		if (artifact.method !== "area-overlap") return undefined;
		const { contentHash, ...withoutHash } = artifact;
		if (contentHash !== sha256(JSON.stringify(withoutHash))) return undefined;
		if (
			artifact.id !== adapter.id ||
			artifact.quality !== adapter.quality ||
			JSON.stringify(artifact.from) !== JSON.stringify(adapter.from) ||
			JSON.stringify(artifact.to) !== JSON.stringify(adapter.to) ||
			JSON.stringify(artifact.weighting) !== JSON.stringify(adapter.weighting) ||
			artifact.validation.overlap.sliverWidthM !== adapter.sliverWidthM ||
			artifact.validation.overlap.minimumCoverage !== adapter.minimumCoverage
		)
			return undefined;
		const expected = [
			["from", adapter.from, adapter.sourceCodePattern],
			["to", adapter.to, undefined],
		] as const;
		for (const [side, endpoint, sourceCodePattern] of expected) {
			const source = geometrySources.get(
				`${endpoint.geography}/${endpoint.boundaryRelease}`,
			);
			const input = artifact.provenance.inputs.find(
				(candidate) => candidate.side === side,
			);
			if (
				!source ||
				!input ||
				input.input !== source.input ||
				input.inputHash !== source.inputHash ||
				input.sourceCodePattern !== sourceCodePattern
			)
				return undefined;
		}
		return artifact;
	} catch {
		return undefined;
	}
};

export const buildCrosswalkInventory = (repositoryRoot: string) => {
	const outputDirectory = join(repositoryRoot, "api", "public");
	if (!existsSync(outputDirectory)) {
		throw new Error(
			`Create the API public directory before building: ${outputDirectory}`,
		);
	}
	const adapters = readCrosswalkAdapters(
		join(repositoryRoot, "api", "config", "crosswalk-adapters.json"),
	);
	const geometrySources = readGeometrySourceLookup(join(repositoryRoot, "api"));
	const reusable = new Map(
		adapters.flatMap((adapter) =>
			adapter.method === "area-overlap"
				? (() => {
						const artifact = reusableAreaOverlap(
							outputDirectory,
							adapter,
							geometrySources,
						);
						return artifact ? [[adapter.id, artifact] as const] : [];
					})()
				: [],
		),
	);
	const pending = adapters.filter((adapter) => !reusable.has(adapter.id));
	const compiled = compileCrosswalks(
		repositoryRoot,
		pending,
		readCompiledAreaLookup(outputDirectory),
		geometrySources,
	);
	const artifactById = new Map([
		...reusable,
		...compiled.artifacts.map((artifact) => [artifact.id, artifact] as const),
	]);
	const artifacts = adapters.map((adapter) => {
		const artifact = artifactById.get(adapter.id);
		if (!artifact) throw new Error(`No compiled artifact for ${adapter.id}`);
		return artifact;
	});
	const inventory = createCrosswalkInventory(artifacts);
	for (const artifact of artifacts) {
		const path = join(outputDirectory, "crosswalks", `${artifact.id}.json`);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, `${JSON.stringify(artifact, null, "\t")}\n`);
	}
	const inventoryPath = join(outputDirectory, "crosswalk-inventory.json");
	writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, "\t")}\n`);
	return { inventoryPath, crosswalkCount: artifacts.length };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = buildCrosswalkInventory(repositoryRoot);
	console.log(
		`Wrote ${result.crosswalkCount} crosswalk to ${result.inventoryPath}`,
	);
}
