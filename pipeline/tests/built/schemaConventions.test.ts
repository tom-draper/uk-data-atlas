import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
	checkSchemaConventions,
	type ConventionAllowlist,
} from "../../src/storage/schemaConventions.js";

/**
 * Every SQLite database in `data/build` follows the conventions in
 * `schemaConventions.ts` (#713). The canonical databases carry no entries:
 * artifact paths, content hashes, byte counts and payload blobs live in the
 * build metadata files beside them (`atlas-build.sqlite` and its siblings),
 * so a build column or a payload table reappearing in `atlas.sqlite` or
 * `atlas-base.sqlite` fails here.
 */
const CANONICAL: ConventionAllowlist = {};

// atlas-base is the stage output atlas.sqlite is assembled from, so it
// carries the same tables without the postcode ones.
const BASE: ConventionAllowlist = {};

// The cache, the website assets and the postcode index are not domain
// databases: they carry payloads and hashes as their data. Their entries stay.
const DATABASES: Array<[string, ConventionAllowlist]> = [
	["atlas.sqlite", CANONICAL],
	["atlas-base.sqlite", BASE],
	[
		"atlas-cache.sqlite",
		{
			"plural-table": ["payloads"],
			"payload-table": ["dataset_payload", "payloads"],
			"build-metadata": [
				"dataset_payload.sha256",
				"dataset_payload.source_sha256",
				"dataset_payload.bytes",
			],
		},
	],
	["website-assets.sqlite", { "build-metadata": ["website_asset.sha256"] }],
	["postcode-index.sqlite", {}],
];

const BUILD = join(
	resolve(dirname(fileURLToPath(import.meta.url)), "../../.."),
	"data/build",
);

describe.each(DATABASES)("%s", (file, allowlist) => {
	const path = join(BUILD, file);
	test.skipIf(!existsSync(path))("follows the schema conventions", () => {
		const database = new DatabaseSync(path, { readOnly: true });
		try {
			expect(checkSchemaConventions(database, allowlist)).toEqual([]);
		} finally {
			database.close();
		}
	});
});
