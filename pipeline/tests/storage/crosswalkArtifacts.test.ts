import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { createCrosswalkArtifacts } from "../../src/storage/crosswalkArtifacts";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "@uk-data-atlas/relationships";

const fixture = (
	context: { onTestFinished: (run: () => void) => void },
	ids: string[],
) => {
	const directory = mkdtempSync(join(tmpdir(), "crosswalk-artifacts-"));
	context.onTestFinished(() =>
		rmSync(directory, { recursive: true, force: true }),
	);
	mkdirSync(join(directory, "crosswalks"));
	for (const id of ids)
		writeFileSync(
			join(directory, "crosswalks", `${id}.json`),
			JSON.stringify({ id, records: [] }),
		);
	const inventory = {
		crosswalks: ids.map((id) => ({
			id,
			artifact: `crosswalks/${id}.json`,
		})),
	} as unknown as CrosswalkInventory;
	return { directory, inventory };
};

test("crosswalk artifacts are read when asked for and only once while held", (context) => {
	const { directory, inventory } = fixture(context, ["a", "b"]);
	const artifacts = createCrosswalkArtifacts(directory, inventory);
	const first = artifacts.get("a");
	assert.equal(first?.id, "a");
	assert.equal(artifacts.get("a"), first);
	assert.equal(artifacts.get("missing"), undefined);
});

test("crosswalk artifacts past the byte limit are read again, oldest first", (context) => {
	const { directory, inventory } = fixture(context, ["a", "b", "c"]);
	const size = Buffer.byteLength(JSON.stringify({ id: "a", records: [] }));
	// Room for two.
	const artifacts = createCrosswalkArtifacts(directory, inventory, size * 2);
	const a = artifacts.get("a");
	const b = artifacts.get("b");
	assert.equal(artifacts.get("a"), a);
	artifacts.get("c");
	// "b" was the least recently used, so it went; "a" stayed.
	assert.equal(artifacts.get("a"), a);
	assert.notEqual(artifacts.get("b"), b);
	// Nothing is held when it cannot fit.
	const none = createCrosswalkArtifacts(directory, inventory, 1);
	assert.notEqual(none.get("a"), none.get("a"));
});

test("an artifact that names another crosswalk is not returned", (context) => {
	const { directory, inventory } = fixture(context, ["a"]);
	writeFileSync(
		join(directory, "crosswalks", "a.json"),
		JSON.stringify({
			id: "other",
			records: [],
		} as unknown as CrosswalkArtifact),
	);
	assert.equal(
		createCrosswalkArtifacts(directory, inventory).get("a"),
		undefined,
	);
});
