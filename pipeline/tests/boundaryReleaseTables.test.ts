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
						validity: [
							{
								purpose: "election_poll",
								validFrom: "2024-07-04",
								validTo: "2024-07-04",
								sourceUrl: "https://example.org/evidence",
								note: "Election day",
							},
						],
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
		const valid = db.prepare(
			"SELECT release FROM boundary_release_validity WHERE geography = ? AND purpose = ? AND ? BETWEEN valid_from AND valid_to",
		);
		expect(valid.all("ward", "election_poll", "2024-07-04")).toHaveLength(
			1,
		);
		expect(valid.all("ward", "election_poll", "2024-07-05")).toHaveLength(
			0,
		);
		expect(valid.all("ward", "other", "2024-07-04")).toHaveLength(0);
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
