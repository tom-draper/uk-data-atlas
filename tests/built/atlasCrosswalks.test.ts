import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";

import {
	readSqliteCrosswalk,
	readSqliteCrosswalkInventory,
} from "@uk-data-atlas/relationships";
import { artifactDirectory, atlasDatabasePath } from "@uk-data-atlas/atlas-db";
import { readStoredText } from "@uk-data-atlas/artifacts";

it("rebuilds every crosswalk artifact from edge rows, with labels from area versions", () => {
	const root = process.cwd();
	const inventory = readSqliteCrosswalkInventory(root);
	expect(inventory.crosswalks.length).toBeGreaterThan(0);
	const mismatches: string[] = [];
	for (const entry of inventory.crosswalks) {
		const text = readStoredText(
			join(artifactDirectory(root), entry.artifact),
		);
		const { artifact, bytes } = readSqliteCrosswalk(root, entry);
		// Endpoint labels come from area versions, so the stored JSON's
		// source-supplied labels are replaced; everything else must match.
		const expected: typeof artifact = JSON.parse(text);
		if (expected.records.length === artifact.records.length) {
			for (const [index, record] of expected.records.entries()) {
				const rebuilt = artifact.records[index]!;
				record.source.labels = rebuilt.source.labels;
				if (record.targets.length !== rebuilt.targets.length) break;
				for (const [target, item] of record.targets.entries())
					item.labels = rebuilt.targets[target]!.labels;
			}
		}
		if (
			!isDeepStrictEqual(artifact, expected) ||
			bytes !== Buffer.byteLength(text)
		)
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
