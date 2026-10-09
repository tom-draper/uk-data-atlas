import { existsSync, readFileSync } from "node:fs";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "./crosswalkInventory";
import type { RelationshipPathInventory } from "./relationshipPaths";
import type { CrosswalkHeader, CrosswalkLookup } from "./resolver/translation";
import { publicPath, readPublicManifest } from "./publicManifest";

export const readCrosswalkInventory = (apiRoot: string): CrosswalkInventory =>
	readPublicManifest<CrosswalkInventory>(
		apiRoot,
		"crosswalk-inventory.json",
		"crosswalks",
		"crosswalk inventory",
	);

/**
 * The crosswalk artifacts, each parsed the first time it is asked for. They
 * are most of a gigabyte of JSON once parsed and a request touches few of
 * them, so reading them all before listening cost seconds of start-up and
 * held the whole set for the life of the process. A missing file still stops
 * the server starting; one that is malformed or stale is refused when read.
 */
class LazyCrosswalkLookup implements CrosswalkLookup {
	private readonly entries: CrosswalkInventory["crosswalks"];
	private readonly paths = new Map<string, string>();
	private readonly loaded = new Map<string, CrosswalkArtifact>();

	constructor(apiRoot: string, inventory: CrosswalkInventory) {
		this.entries = inventory.crosswalks;
		for (const crosswalk of this.entries) {
			const path = publicPath(apiRoot, crosswalk.artifact);
			if (!existsSync(path))
				throw new Error(`Missing crosswalk artifact at ${path}`);
			this.paths.set(crosswalk.id, path);
		}
	}

	get(id: string): CrosswalkArtifact | undefined {
		const cached = this.loaded.get(id);
		if (cached) return cached;
		const expected = this.entries.find((crosswalk) => crosswalk.id === id);
		if (!expected) return undefined;
		const path = this.paths.get(id)!;
		const artifact = JSON.parse(
			readFileSync(path, "utf8"),
		) as CrosswalkArtifact;
		if (
			artifact.schemaVersion !== 1 ||
			artifact.contentHash !== expected.contentHash ||
			!Array.isArray(artifact.records)
		) {
			throw new Error(`Invalid crosswalk artifact at ${path}`);
		}
		this.loaded.set(id, artifact);
		return artifact;
	}

	*values(): Iterable<CrosswalkArtifact> {
		for (const crosswalk of this.entries) yield this.get(crosswalk.id)!;
	}

	where(
		predicate: (header: CrosswalkHeader) => boolean,
	): CrosswalkArtifact[] {
		return this.entries
			.filter(predicate)
			.map((crosswalk) => this.get(crosswalk.id)!);
	}
}

export const readCrosswalkLookup = (
	apiRoot: string,
	inventory: CrosswalkInventory,
): CrosswalkLookup => new LazyCrosswalkLookup(apiRoot, inventory);

export const readRelationshipPathInventory = (
	apiRoot: string,
	crosswalks: CrosswalkInventory,
): RelationshipPathInventory => {
	const path = publicPath(apiRoot, "relationship-paths.json");
	const inventory = JSON.parse(
		readFileSync(path, "utf8"),
	) as RelationshipPathInventory;
	if (
		inventory.schemaVersion !== 1 ||
		!Array.isArray(inventory.paths) ||
		inventory.crosswalkInventoryHash !== crosswalks.contentHash
	) {
		throw new Error(`Invalid relationship path inventory at ${path}`);
	}
	return inventory;
};
