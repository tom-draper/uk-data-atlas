import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	readCrosswalkAdapters,
	type AreaOverlapCrosswalkAdapter,
	type PopulationOverlapCrosswalkAdapter,
	type SameCodeContinuityCrosswalkAdapter,
} from "../src/crosswalkAdapters";
import {
	compileCrosswalks,
	createCrosswalkInventory,
	type AreaOverlapCrosswalkArtifact,
	type CrosswalkArtifact,
	type SameCodeContinuityCrosswalkArtifact,
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

type GeometryCrosswalkAdapter =
	AreaOverlapCrosswalkAdapter | SameCodeContinuityCrosswalkAdapter;

/**
 * Geometry overlays are deliberately expensive. A prior artifact is safe to
 * reuse only when it passes its own hash check and its declared geometry
 * inputs and numeric rules still match the current adapter.
 */
const reusableGeometryCrosswalk = (
	outputDirectory: string,
	adapter: GeometryCrosswalkAdapter,
	geometrySources: ReturnType<typeof readGeometrySourceLookup>,
):
	| AreaOverlapCrosswalkArtifact
	| SameCodeContinuityCrosswalkArtifact
	| undefined => {
	const path = join(outputDirectory, "crosswalks", `${adapter.id}.json`);
	if (!existsSync(path)) return undefined;
	try {
		const artifact = JSON.parse(
			readFileSync(path, "utf8"),
		) as CrosswalkArtifact;
		if (artifact.method !== adapter.method) return undefined;
		const { contentHash, ...withoutHash } = artifact;
		if (contentHash !== sha256(JSON.stringify(withoutHash)))
			return undefined;
		if (
			artifact.id !== adapter.id ||
			artifact.quality !== adapter.quality ||
			JSON.stringify(artifact.from) !== JSON.stringify(adapter.from) ||
			JSON.stringify(artifact.to) !== JSON.stringify(adapter.to) ||
			JSON.stringify(artifact.weighting) !==
				JSON.stringify(adapter.weighting)
		)
			return undefined;
		if (artifact.method === "area-overlap") {
			const overlap = adapter as AreaOverlapCrosswalkAdapter;
			if (
				artifact.validation.overlap.sliverWidthM !==
					overlap.sliverWidthM ||
				artifact.validation.overlap.minimumCoverage !==
					overlap.minimumCoverage
			)
				return undefined;
		} else if (
			artifact.method !== "same-code-continuity" ||
			artifact.validation.continuity.sliverWidthM !== adapter.sliverWidthM
		)
			return undefined;
		const sourceCodePattern =
			adapter.method === "area-overlap"
				? adapter.sourceCodePattern
				: undefined;
		const expected = [
			["from", adapter.from, sourceCodePattern],
			["to", adapter.to, undefined],
		] as const;
		for (const [side, endpoint, pattern] of expected) {
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
				("sourceCodePattern" in input
					? input.sourceCodePattern
					: undefined) !== pattern
			)
				return undefined;
		}
		return artifact;
	} catch {
		return undefined;
	}
};

/**
 * A population overlap is reusable only while everything it was computed
 * from is unchanged: its rules, the area overlap it reweights (which must
 * itself be reused, and by hash), and the block geometry and counts.
 */
const reusablePopulationOverlap = (
	repositoryRoot: string,
	outputDirectory: string,
	adapter: PopulationOverlapCrosswalkAdapter,
	geometrySources: ReturnType<typeof readGeometrySourceLookup>,
	pairs: CrosswalkArtifact | undefined,
): CrosswalkArtifact | undefined => {
	const path = join(outputDirectory, "crosswalks", `${adapter.id}.json`);
	if (!pairs || !existsSync(path)) return undefined;
	try {
		const artifact = JSON.parse(
			readFileSync(path, "utf8"),
		) as CrosswalkArtifact;
		if (artifact.method !== "population-overlap") return undefined;
		const { contentHash, ...withoutHash } = artifact;
		const blocks = geometrySources.get(
			`${adapter.weighting.blocks.geography}/${adapter.weighting.blocks.boundaryRelease}`,
		);
		const populationHash = sha256(
			readFileSync(
				join(repositoryRoot, "data", adapter.population.input),
				"utf8",
			),
		);
		const sameSource = (side: "from" | "to", pattern?: string) => {
			const endpoint = adapter[side];
			const source = geometrySources.get(
				`${endpoint.geography}/${endpoint.boundaryRelease}`,
			);
			const input = artifact.provenance.inputs.find(
				(candidate) => candidate.side === side,
			);
			return (
				source !== undefined &&
				input?.input === source.input &&
				input.inputHash === source.inputHash &&
				input.sourceCodePattern === pattern
			);
		};
		return contentHash === sha256(JSON.stringify(withoutHash)) &&
			JSON.stringify(artifact.weighting) ===
				JSON.stringify(adapter.weighting) &&
			JSON.stringify(artifact.from) === JSON.stringify(adapter.from) &&
			JSON.stringify(artifact.to) === JSON.stringify(adapter.to) &&
			artifact.validation.population.minimumCoverage ===
				adapter.minimumCoverage &&
			artifact.provenance.pairs.crosswalkId === pairs.id &&
			artifact.provenance.pairs.contentHash === pairs.contentHash &&
			blocks !== undefined &&
			artifact.provenance.blocks.input === blocks.input &&
			artifact.provenance.blocks.inputHash === blocks.inputHash &&
			artifact.provenance.population.input === adapter.population.input &&
			artifact.provenance.population.inputHash === populationHash &&
			artifact.provenance.population.codeColumn ===
				adapter.population.codeColumn &&
			artifact.provenance.population.valueColumn ===
				adapter.population.valueColumn &&
			sameSource("from", adapter.sourceCodePattern) &&
			sameSource("to")
			? artifact
			: undefined;
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
	const geometrySources = readGeometrySourceLookup(
		join(repositoryRoot, "api"),
	);
	const reusable = new Map<string, CrosswalkArtifact>(
		adapters.flatMap((adapter) =>
			adapter.method === "area-overlap" ||
			adapter.method === "same-code-continuity"
				? (() => {
						const artifact = reusableGeometryCrosswalk(
							outputDirectory,
							adapter,
							geometrySources,
						);
						return artifact
							? [[adapter.id, artifact] as const]
							: [];
					})()
				: [],
		),
	);
	for (const adapter of adapters) {
		if (adapter.method !== "population-overlap") continue;
		const artifact = reusablePopulationOverlap(
			repositoryRoot,
			outputDirectory,
			adapter,
			geometrySources,
			reusable.get(adapter.pairs),
		);
		if (artifact) reusable.set(adapter.id, artifact);
	}
	const pending = adapters.filter((adapter) => !reusable.has(adapter.id));
	const compiled = compileCrosswalks(
		repositoryRoot,
		pending,
		readCompiledAreaLookup(outputDirectory),
		geometrySources,
		reusable,
	);
	const artifactById = new Map([
		...reusable,
		...compiled.artifacts.map(
			(artifact) => [artifact.id, artifact] as const,
		),
	]);
	const artifacts = adapters.map((adapter) => {
		const artifact = artifactById.get(adapter.id);
		if (!artifact)
			throw new Error(`No compiled artifact for ${adapter.id}`);
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
		`Wrote ${result.crosswalkCount} crosswalks to ${result.inventoryPath}`,
	);
}
