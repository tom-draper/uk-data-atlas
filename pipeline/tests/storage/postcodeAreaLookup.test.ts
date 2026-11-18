import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "vitest";
import {
	IdRegistries,
	areaTables,
	writeSqliteIndex,
} from "../../src/storage/index";
import { FIND_RELEASE_AREA_VERSION } from "../../src/storage/atlasPostcodeAreas";

test("a postcode area is found by its code, not by scanning its release", (context) => {
	const root = mkdtempSync(join(tmpdir(), "postcode-area-lookup-"));
	context.onTestFinished(() =>
		rmSync(root, { recursive: true, force: true }),
	);
	const artifacts = join(root, "artifacts");
	mkdirSync(join(artifacts, "areas"), { recursive: true });
	const release = {
		id: "2024",
		geography: "ward",
		status: "available",
		recordCount: 2,
		artifact: "areas/ward-2024.json",
		contentHash: "sha256:ward-2024",
		codeProperty: "code",
		nameProperty: "name",
	};
	writeFileSync(
		join(artifacts, "area-inventory.json"),
		JSON.stringify({
			schemaVersion: 1,
			contentHash: "sha256:inventory",
			boundaryRegistryHash: "sha256:registry",
			releases: [release],
		}),
	);
	writeFileSync(
		join(artifacts, release.artifact),
		JSON.stringify({
			schemaVersion: 1,
			contentHash: release.contentHash,
			areas: [
				{ code: "A", name: "Area A" },
				{ code: "B", name: "Area B" },
			],
		}),
	);
	const path = join(root, "atlas-base.sqlite");
	writeSqliteIndex(path, {}, areaTables(artifacts, IdRegistries.memory()));
	const database = new DatabaseSync(path, { readOnly: true });
	context.onTestFinished(() => database.close());

	// The file has no `sqlite_stat1`, as when the stage runs.
	const plan = database
		.prepare(`EXPLAIN QUERY PLAN ${FIND_RELEASE_AREA_VERSION}`)
		.all()
		.map((row) => String(row.detail));
	assert.match(plan[0]!, /SEARCH a USING .*\(code=\?\)/);
	assert.match(plan[1]!, /SEARCH v USING .*\(release_id=\? AND area_id=\?\)/);

	const releaseId = database
		.prepare(
			"SELECT id FROM area_releases WHERE geography = 'ward' AND release = '2024'",
		)
		.get()!.id;
	const find = database.prepare(FIND_RELEASE_AREA_VERSION);
	const found = find.get(releaseId, "B");
	assert.ok(found);
	assert.equal(
		database
			.prepare(
				"SELECT a.code FROM area_version v JOIN area a ON a.id = v.area_id WHERE v.id = ?",
			)
			.get(found.id)!.code,
		"B",
	);
	assert.equal(find.get(releaseId, "Z"), undefined);
});
