import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	readCrosswalkAdapters,
	type AreaOverlapCrosswalkAdapter,
	type BestFitCrosswalkAdapter,
	type GeometricContainmentCrosswalkAdapter,
	type PopulationOverlapCrosswalkAdapter,
	type PropertyCrosswalkAdapter,
	type ExtentContinuityCrosswalkAdapter,
} from "../src/crosswalkAdapters";
import {
	compileCrosswalks,
	crosswalkInventoryEntry,
	crosswalkInventoryFromEntries,
	type AreaOverlapCrosswalkArtifact,
	type BestFitCrosswalkArtifact,
	type CrosswalkArtifact,
	type GeometricContainmentCrosswalkArtifact,
	type PropertyCrosswalkArtifact,
	type ExtentContinuityCrosswalkArtifact,
} from "../src/crosswalkInventory";
import {
	CONTAINMENT_TOLERANCE_M,
	geometryContainmentInputs,
} from "../src/crosswalkGeometryValidation";
import { DIFFERENCE_RULE, REALIGNED_SHARE } from "../src/extentContinuity";
import {
	addRelatedCodes,
	releaseCoverageOf,
	type RelatedCodesByRelease,
} from "../src/relatedCodes";
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
	return {
		areaLookup: createAreaLookup(artifacts),
		areaInventoryHash: inventory.contentHash,
	};
};

type GeometryCrosswalkAdapter =
	| AreaOverlapCrosswalkAdapter
	| ExtentContinuityCrosswalkAdapter
	| GeometricContainmentCrosswalkAdapter
	| BestFitCrosswalkAdapter;
type CleanContainmentAdapter = PropertyCrosswalkAdapter & {
	method: "clean-containment";
};

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
	| ExtentContinuityCrosswalkArtifact
	| GeometricContainmentCrosswalkArtifact
	| BestFitCrosswalkArtifact
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
					overlap.minimumCoverage ||
				(artifact.validation.overlap.minimumTargetCoverageRequired ??
					artifact.validation.overlap.minimumCoverage) !==
					(overlap.minimumTargetCoverage ?? overlap.minimumCoverage)
			)
				return undefined;
			if (
				JSON.stringify(artifact.provenance.excludedPairs ?? {}) !==
					JSON.stringify(overlap.excludedPairs ?? {}) ||
				JSON.stringify(artifact.provenance.includedPairs ?? {}) !==
					JSON.stringify(overlap.includedPairs ?? {}) ||
				JSON.stringify(artifact.provenance.indeterminatePairs ?? {}) !==
					JSON.stringify(overlap.indeterminatePairs ?? {}) ||
				JSON.stringify(artifact.provenance.coverageExceptions ?? {}) !==
					JSON.stringify(overlap.coverageExceptions ?? {})
			)
				return undefined;
		} else if (artifact.method === "geometric-containment") {
			if (
				artifact.validation.containment.sliverWidthM !==
				(adapter as GeometricContainmentCrosswalkAdapter).sliverWidthM
			)
				return undefined;
		} else if (artifact.method === "best-fit") {
			if (
				artifact.validation.bestFit.sliverWidthM !==
				(adapter as BestFitCrosswalkAdapter).sliverWidthM
			)
				return undefined;
		} else if (
			artifact.method !== "extent-continuity" ||
			artifact.validation.continuity.sliverWidthM !==
				adapter.sliverWidthM ||
			artifact.validation.continuity.recoded === undefined ||
			artifact.validation.continuity.differenceRule !== DIFFERENCE_RULE ||
			artifact.validation.continuity.realignedShare !== REALIGNED_SHARE
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

/**
 * Geometry validation is the expensive part of a clean-containment adapter.
 * Reuse it only when both geometry files, their correction manifests, the
 * published lookup, and the validation rules are exactly the current ones.
 */
const reusableCleanContainment = (
	repositoryRoot: string,
	outputDirectory: string,
	adapter: CleanContainmentAdapter,
	geometrySources: ReturnType<typeof readGeometrySourceLookup>,
): PropertyCrosswalkArtifact | undefined => {
	const path = join(outputDirectory, "crosswalks", `${adapter.id}.json`);
	if (!existsSync(path)) return undefined;
	try {
		const artifact = JSON.parse(
			readFileSync(path, "utf8"),
		) as PropertyCrosswalkArtifact;
		const { contentHash, ...withoutHash } = artifact;
		const expectedGeometryInputs = geometryContainmentInputs(
			repositoryRoot,
			geometrySources,
			adapter.from,
			adapter.to,
		);
		const inputHash = sha256(
			readFileSync(join(repositoryRoot, "data", adapter.input), "utf8"),
		);
		const containment = artifact.validation.geometryContainment;
		return contentHash === sha256(JSON.stringify(withoutHash)) &&
			artifact.id === adapter.id &&
			artifact.method === adapter.method &&
			artifact.quality === adapter.quality &&
			JSON.stringify(artifact.from) ===
				JSON.stringify({
					geography: adapter.from.geography,
					boundaryRelease: adapter.from.boundaryRelease,
				}) &&
			JSON.stringify(artifact.to) ===
				JSON.stringify({
					geography: adapter.to.geography,
					boundaryRelease: adapter.to.boundaryRelease,
				}) &&
			JSON.stringify(artifact.weighting) ===
				JSON.stringify(adapter.weighting) &&
			artifact.provenance.input === adapter.input &&
			artifact.provenance.inputHash === inputHash &&
			JSON.stringify(artifact.provenance.corrections ?? []) ===
				JSON.stringify(
					Object.entries(adapter.targetCodeCorrections ?? {}).map(
						([sourceCode, correction]) => ({
							sourceCode,
							...correction,
						}),
					),
				) &&
			containment?.status === "checked" &&
			containment.toleranceM === CONTAINMENT_TOLERANCE_M &&
			JSON.stringify(containment.geometryInputs) ===
				JSON.stringify(expectedGeometryInputs)
			? artifact
			: undefined;
	} catch {
		return undefined;
	}
};

export const buildCrosswalkInventory = (repositoryRoot: string) => {
	const outputDirectory = join(repositoryRoot, "services", "api", "public");
	if (!existsSync(outputDirectory)) {
		throw new Error(
			`Create the API public directory before building: ${outputDirectory}`,
		);
	}
	const adapters = readCrosswalkAdapters(
		join(
			repositoryRoot,
			"services",
			"api",
			"config",
			"crosswalk-adapters.json",
		),
	);
	const geometrySources = readGeometrySourceLookup(
		join(repositoryRoot, "services", "api"),
	);
	// Only a population overlap's pairs are needed whole after they are
	// checked: it reweights them. Every other artifact is reduced to its
	// inventory entry, so the build never holds all of them at once.
	const pairIds = new Set(
		adapters.flatMap((adapter) =>
			adapter.method === "population-overlap" ? [adapter.pairs] : [],
		),
	);
	const entries = new Map<
		string,
		ReturnType<typeof crosswalkInventoryEntry>
	>();
	const pairs = new Map<string, CrosswalkArtifact>();
	// What each release's areas are related to is counted as every artifact
	// passes through, so reporting it needs none of them read again.
	const related: RelatedCodesByRelease = new Map();
	const keep = (artifact: CrosswalkArtifact) => {
		entries.set(artifact.id, crosswalkInventoryEntry(artifact));
		addRelatedCodes(related, artifact);
		if (pairIds.has(artifact.id)) pairs.set(artifact.id, artifact);
	};
	for (const adapter of adapters) {
		let artifact: CrosswalkArtifact | undefined;
		if (adapter.method === "clean-containment") {
			artifact = reusableCleanContainment(
				repositoryRoot,
				outputDirectory,
				adapter as CleanContainmentAdapter,
				geometrySources,
			);
		} else if (
			adapter.method === "area-overlap" ||
			adapter.method === "extent-continuity" ||
			adapter.method === "geometric-containment" ||
			adapter.method === "best-fit"
		) {
			artifact = reusableGeometryCrosswalk(
				outputDirectory,
				adapter,
				geometrySources,
			);
		}
		if (artifact) keep(artifact);
	}
	for (const adapter of adapters) {
		if (adapter.method !== "population-overlap") continue;
		const artifact = reusablePopulationOverlap(
			repositoryRoot,
			outputDirectory,
			adapter,
			geometrySources,
			pairs.get(adapter.pairs),
		);
		if (artifact) keep(artifact);
	}
	const pending = adapters.filter((adapter) => !entries.has(adapter.id));
	console.log(
		`Reusing ${entries.size} validated crosswalks; compiling ${pending.length} changed or uncached crosswalks.`,
	);
	const writeArtifact = (artifact: CrosswalkArtifact) => {
		const path = join(outputDirectory, "crosswalks", `${artifact.id}.json`);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, `${JSON.stringify(artifact, null, "\t")}\n`);
	};
	// Geometry crosswalks take minutes each, so each is written as it compiles:
	// a build stopped part way reuses those on its next run, which revalidates
	// every one against its inputs before trusting it. Reused artifacts are
	// already on disk as they were checked, so they are not written again.
	const { areaLookup, areaInventoryHash } =
		readCompiledAreaLookup(outputDirectory);
	compileCrosswalks(
		repositoryRoot,
		pending,
		areaLookup,
		geometrySources,
		pairs,
		(artifact) => {
			writeArtifact(artifact);
			keep(artifact);
		},
	);
	const inventory = crosswalkInventoryFromEntries(
		adapters.map((adapter) => {
			const entry = entries.get(adapter.id);
			if (!entry)
				throw new Error(`No compiled artifact for ${adapter.id}`);
			return entry;
		}),
		{ areaInventoryHash, releases: releaseCoverageOf(related, areaLookup) },
	);
	const inventoryPath = join(outputDirectory, "crosswalk-inventory.json");
	writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, "\t")}\n`);
	return { inventoryPath, crosswalkCount: adapters.length };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../../..");
	const result = buildCrosswalkInventory(repositoryRoot);
	console.log(
		`Wrote ${result.crosswalkCount} crosswalks to ${result.inventoryPath}`,
	);
}
