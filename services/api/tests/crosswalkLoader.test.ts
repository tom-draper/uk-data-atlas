import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readCrosswalkLookup } from "../src/crosswalkLoader";
import type { CrosswalkInventory } from "../src/crosswalkInventory";

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

const withArtifacts = (
	ids: Array<[id: string, geography: string]>,
	write: (directory: string, inventory: CrosswalkInventory) => void,
) => {
	const directory = mkdtempSync(join(tmpdir(), "crosswalk-loader-"));
	try {
		mkdirSync(join(directory, "public", "crosswalks"), { recursive: true });
		const inventory = {
			schemaVersion: 1,
			contentHash: "sha256:inventory",
			crosswalks: ids.map(([id, geography]) => entry(id, geography)),
		} as CrosswalkInventory;
		write(directory, inventory);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
};

const artifact = (
	directory: string,
	id: string,
	contentHash = `sha256:${id}`,
) =>
	writeFileSync(
		join(directory, "public", "crosswalks", `${id}.json`),
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
			const lookup = readCrosswalkLookup(directory, inventory);
			// Removing a file after the lookup exists shows it was not read yet.
			rmSync(
				join(directory, "public", "crosswalks", "parish-to-lad.json"),
			);

			assert.equal(lookup.get("ward-to-lad")?.id, "ward-to-lad");
			assert.equal(lookup.get("ward-to-lad"), lookup.get("ward-to-lad"));
			assert.equal(lookup.get("unknown"), undefined);
			assert.throws(() => lookup.get("parish-to-lad"), /ENOENT/);
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

test("refuses a missing artifact at once and a stale one when it is read", () => {
	withArtifacts([["ward-to-lad", "ward"]], (directory, inventory) => {
		assert.throws(
			() => readCrosswalkLookup(directory, inventory),
			/Missing crosswalk artifact at .*ward-to-lad\.json/,
		);
		artifact(directory, "ward-to-lad", "sha256:other");
		const lookup = readCrosswalkLookup(directory, inventory);
		assert.throws(
			() => lookup.get("ward-to-lad"),
			/Invalid crosswalk artifact at .*ward-to-lad\.json/,
		);
	});
});
