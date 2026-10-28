import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { statSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync, type SQLOutputValue } from "node:sqlite";
import { fileURLToPath } from "node:url";

import {
	readSqliteCrosswalk,
	readSqliteCrosswalkInventory,
} from "@uk-data-atlas/atlas-runtime/storage";
import {
	readSqliteAreas,
	readSqliteAreaInventory,
} from "@uk-data-atlas/atlas-runtime/storage";

const hash = (value: unknown) =>
	createHash("sha256").update(JSON.stringify(value)).digest("hex");

const endpoint = (row: Record<string, SQLOutputValue>) =>
	Object.fromEntries(
		(JSON.parse(row.fields as string) as string[]).map((key) => [
			key,
			key === "labels" ? JSON.parse(row[key] as string) : row[key],
		]),
	);

const crosswalk = (database: DatabaseSync, id: string) => {
	const header = database
		.prepare("SELECT * FROM crosswalks WHERE id = ?")
		.get(id)!;
	const targets = new Map<number, object[]>();
	for (const row of database
		.prepare(
			"SELECT t.*, f.fields FROM crosswalk_targets t JOIN crosswalk_field_sets f ON f.position = t.fieldSetId WHERE t.crosswalkPosition = ? ORDER BY t.sourcePosition, t.position",
		)
		.iterate(header.position)) {
		const position = row.sourcePosition as number;
		let list = targets.get(position);
		if (!list) targets.set(position, (list = []));
		list.push(endpoint(row));
	}
	const records = database
		.prepare(
			"SELECT s.*, f.fields FROM crosswalk_sources s JOIN crosswalk_field_sets f ON f.position = s.fieldSetId WHERE s.crosswalkPosition = ? ORDER BY s.position",
		)
		.all(header.position)
		.map((row) => ({
			source: endpoint(row),
			targets: targets.get(row.position as number) ?? [],
		}));
	assert.equal(records.length, header.recordCount);
	return {
		artifact: { ...JSON.parse(header.header as string), records },
		bytes: header.bytes,
	};
};

export const compareAtlasSqlite = (
	beforePath: string,
	afterApiRoot: string,
) => {
	const afterPath = resolve(afterApiRoot, "../../data/build/atlas.sqlite");
	const before = new DatabaseSync(beforePath, { readOnly: true });
	const after = new DatabaseSync(afterPath, { readOnly: true });
	try {
		const readBefore = (id: string) => {
			const database = new DatabaseSync(beforePath, { readOnly: true });
			try {
				return crosswalk(database, id);
			} finally {
				database.close();
			}
		};
		const inventory = readSqliteCrosswalkInventory(afterApiRoot);
		const entries = new Map(
			inventory.crosswalks.map((entry) => [entry.id, entry]),
		);
		const headers = before
			.prepare("SELECT id, recordCount FROM crosswalks ORDER BY position")
			.all();
		assert.ok(headers.length > 0, "No crosswalks compared");
		// Each rebuilt artifact below includes its header.
		assert.deepEqual(
			inventory.crosswalks.map((entry) => entry.id),
			headers.map((header) => header.id),
		);
		let crosswalkMismatches = 0;
		for (const header of headers) {
			if (
				hash(readBefore(header.id as string)) !==
				hash(
					readSqliteCrosswalk(
						afterApiRoot,
						entries.get(header.id as string)!,
					),
				)
			) {
				crosswalkMismatches++;
				console.error(`Crosswalk mismatch: ${header.id}`);
			}
		}
		const releases = before
			.prepare("SELECT * FROM area_releases ORDER BY position")
			.all();
		assert.ok(releases.length > 0, "No area releases compared");
		assert.deepEqual(
			after
				.prepare("SELECT * FROM area_releases ORDER BY position")
				.all(),
			releases,
		);
		for (const table of [
			"area_inventory",
			"crosswalk_inventory",
			"crosswalk_coverage",
		])
			assert.deepEqual(
				after.prepare(`SELECT * FROM ${table} ORDER BY position`).all(),
				before
					.prepare(`SELECT * FROM ${table} ORDER BY position`)
					.all(),
			);
		let areaMismatches = 0;
		const afterReleases = new Map(
			readSqliteAreaInventory(afterApiRoot)
				.releases.filter((release) => release.status === "available")
				.map((release) => [
					`${release.geography}/${release.id}`,
					release,
				]),
		);
		assert.ok(
			afterReleases.size > 0,
			"No available area releases compared",
		);
		const areas = (release: Record<string, SQLOutputValue>) => {
			const rows = before
				.prepare(
					"SELECT code, name, aliases FROM areas WHERE geography = ? AND boundaryRelease = ? ORDER BY position",
				)
				.all(release.geography, release.id);
			assert.equal(rows.length, release.recordCount);
			return rows.map((row) => ({
				code: row.code,
				name: row.name,
				...(row.aliases === null
					? {}
					: { aliases: JSON.parse(row.aliases as string) }),
			}));
		};
		for (const release of releases.filter(
			(row) => row.status === "available",
		)) {
			if (
				hash(areas(release)) !==
				hash(
					readSqliteAreas(
						afterApiRoot,
						afterReleases.get(
							`${release.geography}/${release.id}`,
						)!,
					),
				)
			) {
				areaMismatches++;
				console.error(
					`Area mismatch: ${release.geography}/${release.id}`,
				);
			}
		}
		const largest = headers.reduce((a, b) =>
			Number(a.recordCount) > Number(b.recordCount) ? a : b,
		);
		const timing = (read: () => ReturnType<typeof crosswalk>) => {
			read();
			const samples = Array.from({ length: 5 }, () => {
				const start = performance.now();
				const result = read();
				assert.ok(result.artifact.records.length > 0);
				return performance.now() - start;
			}).sort((a, b) => a - b);
			return { medianMs: samples[2], samplesMs: samples };
		};
		const size = (database: DatabaseSync, path: string) => ({
			fileBytes: statSync(path).size,
			objects: database
				.prepare(
					"SELECT name, sum(pgsize) AS bytes FROM dbstat GROUP BY name ORDER BY name",
				)
				.all(),
		});
		const result = {
			crosswalksCompared: headers.length,
			areaReleasesCompared: releases.filter(
				(row) => row.status === "available",
			).length,
			crosswalkMismatches,
			areaMismatches,
			benchmark: {
				id: largest.id,
				recordCount: largest.recordCount,
				before: timing(() => readBefore(largest.id as string)),
				after: timing(() =>
					readSqliteCrosswalk(
						afterApiRoot,
						entries.get(largest.id as string)!,
					),
				),
			},
			before: size(before, beforePath),
			after: size(after, afterPath),
		};
		console.log(JSON.stringify(result, null, 2));
		assert.equal(crosswalkMismatches, 0);
		assert.equal(areaMismatches, 0);
		return result;
	} finally {
		before.close();
		after.close();
	}
};

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	assert.equal(
		process.argv.length,
		4,
		"Usage: tsx compare-atlas-sqlite.ts BEFORE.sqlite AFTER_API_ROOT",
	);
	compareAtlasSqlite(resolve(process.argv[2]), resolve(process.argv[3]));
}
