import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";

import {
	readSqliteCrosswalk,
	readSqliteCrosswalkInventory,
} from "@uk-data-atlas/atlas-runtime/storage";
import {
	artifactDirectory,
	atlasDatabasePath,
} from "@uk-data-atlas/atlas-runtime/storage";
import { readStoredText } from "@uk-data-atlas/artifacts";

it("rebuilds every crosswalk artifact byte for byte from edge rows", () => {
	const root = process.cwd();
	const apiRoot = join(root, "services/api");
	const inventory = readSqliteCrosswalkInventory(apiRoot);
	expect(inventory.crosswalks.length).toBeGreaterThan(0);
	const mismatches: string[] = [];
	for (const entry of inventory.crosswalks) {
		const text = readStoredText(
			join(artifactDirectory(root), entry.artifact),
		);
		const { artifact, bytes } = readSqliteCrosswalk(apiRoot, entry);
		// Artifacts are written tab-indented.
		const rebuilt =
			JSON.stringify(artifact, null, "\t") +
			(text.endsWith("\n") ? "\n" : "");
		if (rebuilt !== text || bytes !== Buffer.byteLength(text))
			mismatches.push(entry.id);
	}
	expect(mismatches).toEqual([]);
	const database = new DatabaseSync(atlasDatabasePath(apiRoot), {
		readOnly: true,
	});
	try {
		expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
	} finally {
		database.close();
	}
}, 1_800_000);
