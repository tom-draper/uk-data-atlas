import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";
import { writeSqliteTables } from "@uk-data-atlas/artifacts";
import { boundaryReleaseTables } from "../src/storage/boundaryReleaseTables.ts";

test("stores boundary source metadata and country coverage as queryable rows", () => {
	const db = new DatabaseSync(":memory:");
	try {
		db.exec("PRAGMA foreign_keys = ON");
		writeSqliteTables(
			db,
			boundaryReleaseTables({
				schemaVersion: 1,
				contentHash: "registry-hash",
				releases: [
					{
						id: "2024-12-ew-bgc",
						geography: "ward",
						title: "Wards",
						temporalCoverage: "2024",
						coverage: { countries: ["GB-ENG", "GB-WLS"] },
						source: {
							publisher: "ONS",
							url: "https://example.org",
							licence: { name: "OGL" },
						},
						metadataHash: "hash",
						deprecation: {
							deprecated: "2026-01-01",
							replacedBy: "new",
							reason: "Replaced",
						},
					},
				],
			}),
		);
		expect(
			db
				.prepare(
					"SELECT temporal_coverage, licence, replaced_by FROM boundary_release WHERE geography = ? AND release = ?",
				)
				.get("ward", "2024-12-ew-bgc"),
		).toMatchObject({
			temporal_coverage: "2024",
			licence: "OGL",
			replaced_by: "new",
		});
		expect(
			db
				.prepare(
					"SELECT country FROM boundary_release_country ORDER BY country",
				)
				.all()
				.map((row) => row.country),
		).toEqual(["GB-ENG", "GB-WLS"]);
	} finally {
		db.close();
	}
});
