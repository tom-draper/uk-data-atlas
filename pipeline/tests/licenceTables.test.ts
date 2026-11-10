import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";
import { writeSqliteTables } from "@uk-data-atlas/artifacts";
import { IdRegistries } from "../src/ids/idRegistries.ts";
import { boundaryReleaseTables } from "../src/storage/boundaryReleaseTables.ts";
import { licenceTables } from "../src/storage/licenceTables.ts";

test("records boundary provenance and isolates historical local election licences", () => {
	const db = new DatabaseSync(":memory:");
	const registry = {
		schemaVersion: 1 as const,
		contentHash: "hash",
		releases: [
			{
				id: "2024",
				geography: "ward",
				title: "Wards",
				coverage: { countries: ["GB-ENG"] },
				source: {
					publisher: "ONS",
					url: "https://example.org",
					licence: { name: "Open Government Licence v3.0" },
				},
				metadataHash: "hash",
			},
		],
	};
	try {
		db.exec(`PRAGMA foreign_keys = ON;
		CREATE TABLE source (id INTEGER PRIMARY KEY, publisher TEXT NOT NULL, url TEXT, licence TEXT NOT NULL, licence_url TEXT, citation TEXT);
		CREATE TABLE dataset (id INTEGER PRIMARY KEY, slug TEXT NOT NULL);
		CREATE TABLE election (id INTEGER PRIMARY KEY, dataset_id INTEGER NOT NULL REFERENCES dataset(id), date TEXT NOT NULL);
		CREATE TABLE crosswalk (id INTEGER PRIMARY KEY, provenance TEXT NOT NULL);
		INSERT INTO source VALUES (1, 'mixed', 'https://example.org/mixed', 'Open Parliament Licence (2021–2025); CC BY-SA 3.0 (2016–2019)', NULL, NULL);
		INSERT INTO dataset VALUES (1, 'local-election');
		INSERT INTO election VALUES (1, 1, '2019-05-02'), (2, 1, '2024-05-02');`);
		db.prepare("INSERT INTO crosswalk VALUES (?, ?)").run(
			1,
			JSON.stringify({
				inputs: [
					{ input: "boundaries/ward/2024/ward.geojson" },
					{ input: "other/unknown.csv" },
				],
			}),
		);
		writeSqliteTables(db, boundaryReleaseTables(registry));
		const ids = IdRegistries.memory();
		ids.source.assign(
			JSON.stringify([
				"mixed",
				"https://example.org/mixed",
				"Open Parliament Licence (2021–2025); CC BY-SA 3.0 (2016–2019)",
			]),
		);
		writeSqliteTables(db, licenceTables(registry, ids));
		expect(
			db
				.prepare(
					"SELECT election_id, licence_id FROM election_licence ORDER BY election_id",
				)
				.all(),
		).toEqual([
			expect.objectContaining({
				election_id: 1,
				licence_id: "cc-by-sa-3.0",
			}),
			expect.objectContaining({
				election_id: 2,
				licence_id: "open-parliament",
			}),
		]);
		expect(
			db
				.prepare(
					"SELECT l.share_alike FROM crosswalk_provenance_source c JOIN source_licence sl ON sl.source_id = c.source_id JOIN licence l ON l.id = sl.licence_id",
				)
				.all(),
		).toEqual([expect.objectContaining({ share_alike: 0 })]);
		expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
	} finally {
		db.close();
	}
});
