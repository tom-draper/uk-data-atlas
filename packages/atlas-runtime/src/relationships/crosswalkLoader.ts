import {
	readSqliteCrosswalkInventory,
	readSqliteCrosswalk,
} from "../storage/atlasCrosswalks";
import { readAtlasPayload } from "../storage/atlasSqlite";
import type { CrosswalkArtifact } from "@uk-data-atlas/relationships";
import type { CrosswalkInventory } from "@uk-data-atlas/relationships";
import type { RelationshipPathInventory } from "@uk-data-atlas/relationships";
import type { CrosswalkHeader, CrosswalkLookup } from "@uk-data-atlas/relationships";
import { atlasDatabasePath, repositoryRootOf } from "../storage/dataLayout";

export const readCrosswalkInventory = readSqliteCrosswalkInventory;

export const DEFAULT_CROSSWALK_CACHE_BYTES = 64 * 1024 * 1024;

class LazyCrosswalkLookup implements CrosswalkLookup {
	private readonly entries: CrosswalkInventory["crosswalks"];
	private readonly loaded = new Map<
		string,
		{ artifact: CrosswalkArtifact; bytes: number }
	>();
	private bytes = 0;

	constructor(
		private readonly apiRoot: string,
		inventory: CrosswalkInventory,
		private readonly maxBytes: number,
	) {
		if (!Number.isSafeInteger(maxBytes) || maxBytes < 0)
			throw new Error(
				"Crosswalk cache bytes must be a non-negative safe integer.",
			);
		this.entries = inventory.crosswalks;
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
		const { artifact, bytes } = readSqliteCrosswalk(this.apiRoot, expected);
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
	const path = atlasDatabasePath(apiRoot);
	const inventory = JSON.parse(
		readAtlasPayload(repositoryRootOf(apiRoot), "relationship-paths"),
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
