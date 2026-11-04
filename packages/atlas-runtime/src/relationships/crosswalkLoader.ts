import {
	readSqliteCrosswalkInventory,
	readSqliteCrosswalk,
} from "../storage/atlasCrosswalks.ts";
import { readAtlasPayload } from "../storage/atlasSqlite.ts";
import type { CrosswalkArtifact } from "@uk-data-atlas/relationships";
import type { CrosswalkInventory } from "@uk-data-atlas/relationships";
import type { RelationshipPathInventory } from "@uk-data-atlas/relationships";
import type {
	CrosswalkHeader,
	CrosswalkLookup,
} from "@uk-data-atlas/relationships";
import { atlasDatabasePath } from "../storage/dataLayout.ts";

export const readCrosswalkInventory = readSqliteCrosswalkInventory;

export const DEFAULT_CROSSWALK_CACHE_BYTES = 64 * 1024 * 1024;

class LazyCrosswalkLookup implements CrosswalkLookup {
	private readonly entries: CrosswalkInventory["crosswalks"];
	private readonly loaded = new Map<
		string,
		{ artifact: CrosswalkArtifact; bytes: number }
	>();
	private bytes = 0;

	private readonly repositoryRoot: string;
	private readonly maxBytes: number;
	private readonly databasePath?: string;
	constructor(
		repositoryRoot: string,
		inventory: CrosswalkInventory,
		maxBytes: number,
		databasePath?: string,
	) {
		this.repositoryRoot = repositoryRoot;
		this.maxBytes = maxBytes;
		this.databasePath = databasePath;

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
		const { artifact, bytes } = readSqliteCrosswalk(
			this.repositoryRoot,
			expected,
			this.databasePath,
		);
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
	repositoryRoot: string,
	inventory: CrosswalkInventory,
	maxBytes = DEFAULT_CROSSWALK_CACHE_BYTES,
	databasePath?: string,
): CrosswalkLookup =>
	new LazyCrosswalkLookup(repositoryRoot, inventory, maxBytes, databasePath);

export const readRelationshipPathInventory = (
	repositoryRoot: string,
	crosswalks: CrosswalkInventory,
): RelationshipPathInventory => {
	const path = atlasDatabasePath(repositoryRoot);
	const inventory = JSON.parse(
		readAtlasPayload(repositoryRoot, "relationship-paths"),
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
