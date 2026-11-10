import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";
import { writeSqliteTables } from "@uk-data-atlas/artifacts";
import { IdRegistries } from "../src/ids/idRegistries.ts";
import {
	crosswalkInputSourceTables,
	weightInputPaths,
} from "../src/storage/crosswalkInputSources.ts";

test("records the actual population and postcode atom inputs with source links", () => {
	const root = mkdtempSync(join(tmpdir(), "atlas-inputs-"));
	const db = new DatabaseSync(":memory:");
	try {
		const base = join(root, "data/source");
		const metadata = JSON.stringify({
			publisher: "Publisher",
			sourceUrl: "https://example.org",
			licence: { name: "Open Government Licence v3.0" },
		});
		const edition = join(base, "postcodes/onspd/2026");
		mkdirSync(edition, { recursive: true });
		writeFileSync(join(edition, "meta.json"), metadata);
		const atoms = weightInputPaths(root);
		const population = "counts/population/input.csv";
		for (const input of [...atoms, population]) {
			const dir = dirname(join(base, input));
			mkdirSync(dir, { recursive: true });
			writeFileSync(join(dir, "meta.json"), metadata);
		}
		db.exec(`PRAGMA foreign_keys = ON;
   CREATE TABLE source (id INTEGER PRIMARY KEY, publisher TEXT, url TEXT, licence TEXT, licence_url TEXT, citation TEXT);
   CREATE TABLE licence (id TEXT PRIMARY KEY); INSERT INTO licence VALUES ('ogl-3.0');
   CREATE TABLE source_licence (source_id INTEGER REFERENCES source(id), licence_id TEXT REFERENCES licence(id), PRIMARY KEY(source_id, licence_id));
   CREATE TABLE crosswalk (id INTEGER PRIMARY KEY, method TEXT, provenance TEXT);`);
		const add = db.prepare("INSERT INTO crosswalk VALUES (?, ?, ?)");
		add.run(
			1,
			"population-overlap",
			JSON.stringify({ population: { input: population } }),
		);
		add.run(2, "postcode-overlap", JSON.stringify({}));
		add.run(3, "official-lookup", JSON.stringify({}));
		writeSqliteTables(
			db,
			crosswalkInputSourceTables(root, IdRegistries.memory()),
		);
		expect(
			db
				.prepare(
					"SELECT input FROM crosswalk_count_source WHERE crosswalk_id = 1",
				)
				.all(),
		).toEqual([expect.objectContaining({ input: population })]);
		expect(
			db
				.prepare(
					"SELECT count(*) AS n FROM crosswalk_count_source WHERE crosswalk_id = 2",
				)
				.get(),
		).toMatchObject({ n: atoms.length });
		expect(
			db
				.prepare(
					"SELECT count(*) AS n FROM crosswalk_count_source WHERE crosswalk_id = 3",
				)
				.get(),
		).toMatchObject({ n: 0 });
		expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
	} finally {
		db.close();
		rmSync(root, { recursive: true, force: true });
	}
});
