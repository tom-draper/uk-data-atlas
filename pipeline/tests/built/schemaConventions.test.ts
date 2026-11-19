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
 * `schemaConventions.ts` (#713), except for the entries below. Each entry is
 * outstanding work, not a decision: the test fails when one stops matching,
 * so fixing a table means deleting its line.
 *
 * - build metadata and payloads (#713, separation part, owned by the
 *   `refactor/build-metadata-separation` branch): artifact paths, content
 *   hashes and byte counts still sit in the domain tables listed, and
 *   `payloads` still holds dataset payload blobs in the canonical database.
 *   That branch removes these entries; do not fix them here.
 */
const SELECTOR_TABLES = [
	"statistics_selector",
	"statistics_selector_code",
	"statistics_selector_column",
	"statistics_selector_column_member",
	"statistics_selector_list",
	"statistics_selector_member",
	"statistics_selector_option",
];

const CANONICAL: ConventionAllowlist = {
	"plural-table": ["payloads"],
	"payload-table": ["payloads"],
	"build-metadata": [
		"area_release.artifact",
		"area_release.content_hash",
		"boundary_registry.content_hash",
		"crosswalk.artifact",
		"crosswalk.content_hash",
		"crosswalk.bytes",
		"dataset.compiled_bytes",
		"dataset.compiled_sha256",
		"postcode_area_shard_hash.coordinates_sha256",
		"postcode_area_shard_hash.sha256",
		"statistics_observation_fallback.artifact",
		...SELECTOR_TABLES.map((table) => `${table}.artifact`),
	],
};

// atlas-base is the stage output atlas.sqlite is assembled from, so it
// carries the same tables without the postcode ones.
const BASE: ConventionAllowlist = {
	...CANONICAL,
	"camel-case": [],
	"plural-table": ["payloads"],
	"build-metadata": CANONICAL["build-metadata"]!.filter(
		(subject) =>
			!subject.startsWith("postcode_") &&
			!subject.startsWith("statistics_"),
	),
};

// Files whose job is to carry payloads, so hashes and byte counts are data.
const DATABASES: Array<[string, ConventionAllowlist]> = [
	["atlas.sqlite", CANONICAL],
	["atlas-base.sqlite", BASE],
	[
		"atlas-cache.sqlite",
		{
			"plural-table": ["payloads"],
			"payload-table": ["payloads"],
			"build-metadata": [
				"dataset_payload.sha256",
				"dataset_payload.source_sha256",
				"dataset_payload.bytes",
			],
		},
	],
	["website-assets.sqlite", { "build-metadata": ["website_asset.sha256"] }],
	[
		"postcode-index.sqlite",
		{
			"plural-table": ["payloads"],
			"payload-table": ["payloads"],
		},
	],
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
