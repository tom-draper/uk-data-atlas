import { strict as assert } from "node:assert";
import {
	mkdtempSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { describe, it } from "vitest";
import {
	postcodeRow,
	postcodeSource,
} from "../../services/api/tests/postcodeFixtures";
import { compilePostcodeIndex } from "../../pipeline/src/postcodeIndex";
import { buildDuckdbPostcodeIndex } from "../../pipeline/src/duckdbPostcodeIndex";

const header = "pcds,dointr,doterm,usrtypind,east1m,north1m,gridind,ctry24cd";
const csv = (rows: ReturnType<typeof postcodeRow>[]) =>
	[
		header,
		...rows.map((row) =>
			[
				row.pcds,
				row.dointr,
				row.doterm,
				row.usrtypind,
				row.east1m,
				row.north1m,
				row.gridind,
				row.ctry,
			].join(","),
		),
	].join("\n") + "\n";

describe("DuckDB postcode index", () => {
	it("matches the Node artifact and rejects invalid input without publishing", async () => {
		const root = mkdtempSync(join(tmpdir(), "atlas-index-test-"));
		try {
			const build = join(root, "data/build");
			mkdirSync(build, { recursive: true });
			const database = new DatabaseSync(join(build, "atlas.sqlite"));
			database.exec(
				"CREATE TABLE payloads (id TEXT PRIMARY KEY, payload TEXT NOT NULL)",
			);
			database.close();
			const rows = [
				postcodeRow("SW1A 1AA"),
				postcodeRow("AB1 1AA", { doterm: "202001" }),
				postcodeRow("AB1 1AB", {
					gridind: "9",
					east1m: "",
					north1m: "",
				}),
			];
			const path = join(root, "source.csv.gz");
			writeFileSync(path, gzipSync(csv(rows)));
			const expected = compilePostcodeIndex(
				rows,
				postcodeSource,
			).artifact;
			const result = await buildDuckdbPostcodeIndex(
				root,
				path,
				postcodeSource,
			);
			assert.deepEqual(result.artifact, expected);
			const before = readFileSync(join(build, "atlas.sqlite"));
			writeFileSync(path, gzipSync(csv([...rows, rows[0]!])));
			await assert.rejects(
				buildDuckdbPostcodeIndex(root, path, postcodeSource),
				/appears twice/,
			);
			assert.deepEqual(readFileSync(join(build, "atlas.sqlite")), before);
			writeFileSync(
				path,
				gzipSync(csv([postcodeRow("BT1 1AA", { ctry: "N92000002" })])),
			);
			await assert.rejects(
				buildDuckdbPostcodeIndex(root, path, postcodeSource),
				/Northern Ireland/,
			);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	}, 30000);
});
