import { areaTables } from "@uk-data-atlas/atlas-runtime/storage";
import { emptyCrosswalkAreas } from "./helpers/sqliteAreas";
import { DatabaseSync } from "node:sqlite";
import { crosswalkTables } from "@uk-data-atlas/atlas-runtime/storage";
import { writeSqliteIndex } from "@uk-data-atlas/atlas-runtime/storage";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readCrosswalkLookup } from "@uk-data-atlas/atlas-runtime/relationships";
import type { CrosswalkInventory } from "../src/crosswalkInventory";
import { artifactRoot } from "@uk-data-atlas/atlas-runtime/storage";

const entry = (id: string, geography: string) => ({
	id,
	from: { geography, boundaryRelease: "2024" },
	to: { geography: "localAuthority", boundaryRelease: "2024" },
	method: "clean-containment" as const,
	quality: "publisher-supplied" as const,
	weighting: { status: "not-applicable" as const },
	recordCount: 0,
	artifact: `crosswalks/${id}.json`,
	contentHash: `sha256:${id}`,
});

const store = (apiRoot: string, inventory: CrosswalkInventory) => {
	const directory = artifactRoot(apiRoot);
	writeFileSync(
		join(directory, "crosswalk-inventory.json"),
		JSON.stringify(inventory),
	);
	emptyCrosswalkAreas(directory, inventory);
	mkdirSync(join(apiRoot, "../../data/build"), { recursive: true });
	writeSqliteIndex(
		join(apiRoot, "../../data/build/atlas.sqlite"),
		{},
		{ ...areaTables(directory), ...crosswalkTables(directory) },
	);
};

const withArtifacts = (
	ids: Array<[id: string, geography: string]>,
	write: (directory: string, inventory: CrosswalkInventory) => void,
) => {
	const root = mkdtempSync(join(tmpdir(), "crosswalk-loader-"));
	const directory = join(root, "services/api");
	try {
		mkdirSync(join(artifactRoot(directory), "crosswalks"), {
			recursive: true,
		});
		const inventory = {
			schemaVersion: 1,
			contentHash: "sha256:inventory",
			crosswalks: ids.map(([id, geography]) => entry(id, geography)),
		} as CrosswalkInventory;
		write(directory, inventory);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
};

const artifact = (
	directory: string,
	id: string,
	contentHash = `sha256:${id}`,
) =>
	writeFileSync(
		join(artifactRoot(directory), "crosswalks", `${id}.json`),
		JSON.stringify({ schemaVersion: 1, id, contentHash, records: [] }),
	);

test("reads a crosswalk artifact only when it is asked for", () => {
	withArtifacts(
		[
			["ward-to-lad", "ward"],
			["parish-to-lad", "parish"],
		],
		(directory, inventory) => {
			artifact(directory, "ward-to-lad");
			artifact(directory, "parish-to-lad");
			store(directory, inventory);
			const lookup = readCrosswalkLookup(directory, inventory);

			rmSync(
				join(
					artifactRoot(directory),
					"crosswalks",
					"parish-to-lad.json",
				),
			);

			assert.equal(lookup.get("ward-to-lad")?.id, "ward-to-lad");
			assert.equal(lookup.get("ward-to-lad"), lookup.get("ward-to-lad"));
			assert.equal(lookup.get("unknown"), undefined);
			assert.equal(lookup.get("parish-to-lad")?.id, "parish-to-lad");
		},
	);
});

test("selects by header and lists in inventory order", () => {
	withArtifacts(
		[
			["b-parish", "parish"],
			["a-ward", "ward"],
			["c-ward", "ward"],
		],
		(directory, inventory) => {
			for (const { id } of inventory.crosswalks) artifact(directory, id);
			store(directory, inventory);
			const lookup = readCrosswalkLookup(directory, inventory);

			assert.deepEqual(
				lookup.where!(({ from }) => from.geography === "ward").map(
					({ id }) => id,
				),
				["a-ward", "c-ward"],
			);
			assert.deepEqual(
				[...lookup.values()].map(({ id }) => id),
				["b-parish", "a-ward", "c-ward"],
			);
		},
	);
});

test("refuses a missing database and stale SQLite artifact", () => {
	withArtifacts([["ward-to-lad", "ward"]], (directory, inventory) => {
		assert.throws(
			() => readCrosswalkLookup(directory, inventory).get("ward-to-lad"),
			/unable to open database file/,
		);
		artifact(directory, "ward-to-lad");
		store(directory, inventory);
		const database = new DatabaseSync(
			join(directory, "../../data/build/atlas.sqlite"),
		);
		database.prepare("UPDATE crosswalk SET content_hash = 'stale'").run();
		database.close();
		assert.throws(
			() => readCrosswalkLookup(directory, inventory).get("ward-to-lad"),
			/Invalid crosswalk artifact/,
		);
	});
});

test("evicts the least recently used crosswalk by JSON bytes and reloads it", () => {
	withArtifacts(
		[
			["a", "ward"],
			["b", "ward"],
			["c", "ward"],
		],
		(directory, inventory) => {
			for (const { id } of inventory.crosswalks) artifact(directory, id);
			const bytes = Buffer.byteLength(
				JSON.stringify({
					schemaVersion: 1,
					id: "a",
					contentHash: "sha256:a",
					records: [],
				}),
			);
			store(directory, inventory);
			const lookup = readCrosswalkLookup(directory, inventory, bytes * 2);
			const a = lookup.get("a");
			const b = lookup.get("b");
			assert.equal(lookup.get("a"), a);
			lookup.get("c");
			assert.equal(lookup.get("a"), a);
			assert.notEqual(lookup.get("b"), b);
			assert.deepEqual(lookup.get("b"), b);
		},
	);
});

test("serves an oversized crosswalk without retaining it or evicting a smaller one", () => {
	withArtifacts(
		[
			["a", "ward"],
			["larger", "ward"],
		],
		(directory, inventory) => {
			for (const { id } of inventory.crosswalks) artifact(directory, id);
			const bytes = Buffer.byteLength(
				JSON.stringify({
					schemaVersion: 1,
					id: "a",
					contentHash: "sha256:a",
					records: [],
				}),
			);
			store(directory, inventory);
			const lookup = readCrosswalkLookup(directory, inventory, bytes);
			const a = lookup.get("a");
			assert.notEqual(lookup.get("larger"), lookup.get("larger"));
			assert.equal(lookup.get("a"), a);
			const uncached = readCrosswalkLookup(directory, inventory, 0);
			assert.notEqual(uncached.get("a"), uncached.get("a"));
		},
	);
});
