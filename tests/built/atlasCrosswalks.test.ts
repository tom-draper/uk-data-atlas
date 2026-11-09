import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";

import {
	readSqliteCrosswalk,
	readSqliteCrosswalkInventory,
} from "@uk-data-atlas/atlas-runtime/relationships";
import { artifactDirectory, atlasDatabasePath } from "@uk-data-atlas/atlas-db";
import { readStoredText } from "@uk-data-atlas/artifacts";

it("rebuilds every crosswalk artifact byte for byte from edge rows", () => {
	const root = process.cwd();
	const inventory = readSqliteCrosswalkInventory(root);
	expect(inventory.crosswalks.length).toBeGreaterThan(0);
	const mismatches: string[] = [];
	for (const entry of inventory.crosswalks) {
		const text = readStoredText(
			join(artifactDirectory(root), entry.artifact),
		);
		const { artifact, bytes } = readSqliteCrosswalk(root, entry);
		// Artifacts are written tab-indented.
		const rebuilt =
			JSON.stringify(artifact, null, "\t") +
			(text.endsWith("\n") ? "\n" : "");
		if (rebuilt !== text || bytes !== Buffer.byteLength(text))
			mismatches.push(entry.id);
	}
	expect(mismatches).toEqual([]);
	const database = new DatabaseSync(atlasDatabasePath(root), {
		readOnly: true,
	});
	try {
		expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
	} finally {
		database.close();
	}
}, 1_800_000);
