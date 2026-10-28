import assert from "node:assert/strict";
import test from "node:test";
import { LazyAreaLookup, type AreaInventory } from "@uk-data-atlas/areas";

const inventory: AreaInventory = {
	schemaVersion: 1,
	contentHash: "inventory",
	boundaryRegistryHash: "registry",
	releases: ["2023", "2024"].map((id) => ({
		id,
		geography: "ward",
		status: "available" as const,
		recordCount: 1,
		artifact: id,
		contentHash: id,
		codeProperty: "code",
		nameProperty: "name",
	})),
};

test("area lookups use the supplied reader and evict least recently used releases", () => {
	const reads: string[] = [];
	const lookup = new LazyAreaLookup(
		(release) => {
			reads.push(release.id);
			return [{ code: release.id, name: `Ward ${release.id}` }];
		},
		inventory,
		1,
	);
	assert.deepEqual([...lookup.keys()], ["ward/2023", "ward/2024"]);
	assert.deepEqual(reads, []);
	assert.equal(lookup.get("ward/2023")?.get("2023")?.name, "Ward 2023");
	lookup.get("ward/2023");
	lookup.get("ward/2024");
	lookup.get("ward/2023");
	assert.deepEqual(reads, ["2023", "2024", "2023"]);
	assert.equal(lookup.get("missing"), undefined);
});
