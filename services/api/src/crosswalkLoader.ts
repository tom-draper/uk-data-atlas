import { readFileSync } from "node:fs";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "./crosswalkInventory";
import type { RelationshipPathInventory } from "./relationshipPaths";
import type { CrosswalkHeader, CrosswalkLookup } from "./resolver/translation";
import { publicPath, readPublicManifest } from "./publicManifest";
import { readStoredText, storedTextExists } from "./storedText";

export const readCrosswalkInventory = (apiRoot: string): CrosswalkInventory =>
	readPublicManifest<CrosswalkInventory>(
		apiRoot,
		"crosswalk-inventory.json",
		"crosswalks",
		"crosswalk inventory",
	);

export const DEFAULT_CROSSWALK_CACHE_BYTES = 64 * 1024 * 1024;

/**
 * The crosswalk artifacts, read on demand and retained within a JSON byte budget. They
 * are most of a gigabyte of JSON once parsed and a request touches few of
 * them, so reading them all before listening cost seconds of start-up and
 * held the whole set for the life of the process. A missing file still stops
 * the server starting; one that is malformed or stale is refused when read.
 */
class LazyCrosswalkLookup implements CrosswalkLookup {
	private readonly entries: CrosswalkInventory["crosswalks"];
	private readonly paths = new Map<string, string>();
	private readonly loaded = new Map<
		string,
		{ artifact: CrosswalkArtifact; bytes: number }
	>();
	private bytes = 0;

	constructor(
		apiRoot: string,
		inventory: CrosswalkInventory,
		private readonly maxBytes: number,
	) {
		if (!Number.isSafeInteger(maxBytes) || maxBytes < 0)
			throw new Error(
				"Crosswalk cache bytes must be a non-negative safe integer.",
			);
		this.entries = inventory.crosswalks;
		for (const crosswalk of this.entries) {
			const path = publicPath(apiRoot, crosswalk.artifact);
			if (!storedTextExists(path))
				throw new Error(`Missing crosswalk artifact at ${path}`);
			this.paths.set(crosswalk.id, path);
		}
	}

	get(id: string): CrosswalkArtifact | undefined {
		const cached = this.loaded.get(id);
		if (cached) {
			this.loaded.delete(id);
			this.loaded.set(id, cached);
			return cached.artifact;
		}
		const expected = this.entries.find((crosswalk) => crosswalk.id === id);
		if (!expected) return undefined;
		const path = this.paths.get(id)!;
		const json = readStoredText(path);
		const bytes = Buffer.byteLength(json);
		const artifact = JSON.parse(json) as CrosswalkArtifact;
		if (
			artifact.schemaVersion !== 1 ||
			artifact.contentHash !== expected.contentHash ||
			!Array.isArray(artifact.records)
		) {
			throw new Error(`Invalid crosswalk artifact at ${path}`);
		}
		if (bytes <= this.maxBytes) {
			while (this.bytes + bytes > this.maxBytes) {
				const oldest = this.loaded.keys().next().value!;
				this.bytes -= this.loaded.get(oldest)!.bytes;
				this.loaded.delete(oldest);
			}
			this.loaded.set(id, { artifact, bytes });
			this.bytes += bytes;
		}
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
	maxBytes = DEFAULT_CROSSWALK_CACHE_BYTES,
): CrosswalkLookup => new LazyCrosswalkLookup(apiRoot, inventory, maxBytes);

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
