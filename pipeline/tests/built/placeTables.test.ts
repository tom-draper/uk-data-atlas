import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { afterAll, test } from "vitest";
import { readSqliteNamedLocationInventory } from "../../../packages/places/src/atlasNamedLocationReader.ts";

/**
 * The places moved to integer ids and a foreign key to `area`. The API reads
 * them through the reader, so its inventory must equal the one the build
 * compiled, and the foreign keys must hold (`pnpm data:build --only
 * assemble-atlas`).
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const ATLAS = join(ROOT, "data/build/atlas.sqlite");
const database = new DatabaseSync(ATLAS, { readOnly: true });
afterAll(() => database.close());

test("the reader returns the compiled inventory, with geometry rounded", () => {
	const compiled = JSON.parse(
		readFileSync(
			join(ROOT, "data/build/artifacts/named-locations.json"),
			"utf8",
		),
	);
	const stored = readSqliteNamedLocationInventory(ROOT, ATLAS);
	assert.equal(stored.locations.length, compiled.locations.length);
	for (const [index, location] of stored.locations.entries()) {
		const expected = compiled.locations[index];
		const { geometry, ...rest } = location;
		const { geometry: compiledGeometry, ...compiledRest } = expected;
		assert.deepEqual(rest, compiledRest, location.id);
		assert.equal(geometry === undefined, compiledGeometry === undefined);
		if (geometry && compiledGeometry)
			assert.equal(
				geometry.boundaryRelease,
				compiledGeometry.boundaryRelease,
			);
	}
});

test("every place member is an area of the place's geography", () => {
	assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
	for (const table of [
		"place_member",
		"place_assertion",
		"place_partial_member",
	])
		assert.deepEqual(
			database
				.prepare(
					`SELECT m.place_id, m.area_id FROM ${table} m
					 JOIN place p ON p.id = m.place_id
					 JOIN area a ON a.id = m.area_id
					 JOIN geography g ON g.id = a.geography_id
					 WHERE g.slug <> p.member_geography`,
				)
				.all(),
			[],
			table,
		);
});
