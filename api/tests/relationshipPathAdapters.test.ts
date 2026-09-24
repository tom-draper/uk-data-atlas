import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { readApprovedRelationshipPaths } from "../src/relationshipPathAdapters";

const read = (paths: unknown[]) => {
	const directory = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		const path = join(directory, "relationship-paths.json");
		writeFileSync(path, JSON.stringify({ schemaVersion: 1, paths }));
		return readApprovedRelationshipPaths(path);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
};

test("reads reviewed path purposes and directions", () => {
	assert.deepEqual(
		read([
			{
				id: "ward-to-authority",
				purpose: "membership",
				steps: [
					{ crosswalkId: "ward-to-authority", direction: "forward" },
				],
			},
		]),
		[
			{
				id: "ward-to-authority",
				purpose: "membership",
				steps: [
					{ crosswalkId: "ward-to-authority", direction: "forward" },
				],
			},
		],
	);
});

test("rejects invalid purpose, direction, duplicate IDs and malformed steps", () => {
	assert.throws(() => read([{ id: "p", purpose: "typo", steps: [] }]));
	assert.throws(() =>
		read([
			{
				id: "p",
				purpose: "identity",
				steps: [{ crosswalkId: "x", direction: "sideways" }],
			},
		]),
	);
	assert.throws(() =>
		read([
			{ id: "p", purpose: "identity", steps: [] },
			{ id: "p", purpose: "identity", steps: [] },
		]),
	);
	assert.throws(() =>
		read([{ id: "p", purpose: "identity", steps: [null] }]),
	);
});
