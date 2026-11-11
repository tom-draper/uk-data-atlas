import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";
import { writeSqliteTables } from "@uk-data-atlas/artifacts";
import {
	boundaryReleaseTables,
	releaseReferencePeriod,
} from "../src/storage/boundaryReleaseTables.ts";

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

const release = (geography: string, id: string, title = geography) => ({
	id,
	geography,
	title,
	coverage: { countries: ["GB-ENG"] },
	source: {
		publisher: "ONS",
		url: "https://example.org",
		licence: { name: "OGL" },
	},
	metadataHash: "hash",
});

test("answers which snapshot was current on a date from release reference periods", () => {
	const db = new DatabaseSync(":memory:");
	try {
		writeSqliteTables(
			db,
			boundaryReleaseTables({
				schemaVersion: 1,
				contentHash: "registry-hash",
				releases: [
					release("la", "2022-12-uk-bgc", "LAD, December 2022"),
					release("la", "2023-05-uk-bgc", "LAD, May 2023"),
					release("la", "2023-05-uk-bgc-v2", "LAD, May 2023, v2"),
					release("la", "2023-12-uk-bgc", "LAD, December 2023"),
					release("zone", "2011-ni"),
					release("zone", "2021-ni"),
				],
			}),
		);
		const current = db.prepare(
			"SELECT release FROM boundary_release_edition WHERE geography = ? AND ? >= edition_from AND (edition_until IS NULL OR ? < edition_until) ORDER BY release",
		);
		const on = (geography: string, date: string) =>
			current.all(geography, date, date).map((row) => row.release);
		expect(on("la", "2023-04-30")).toEqual(["2022-12-uk-bgc"]);
		expect(on("la", "2023-05-01")).toEqual([
			"2023-05-uk-bgc",
			"2023-05-uk-bgc-v2",
		]);
		expect(on("la", "2030-01-01")).toEqual(["2023-12-uk-bgc"]);
		expect(on("la", "2022-11-30")).toEqual([]);
		expect(on("zone", "2015-06-01")).toEqual(["2011-ni"]);
		expect(on("zone", "2021-01-01")).toEqual(["2021-ni"]);
	} finally {
		db.close();
	}
});

test("reads reference periods from release ids and rejects disagreeing titles", () => {
	expect(
		releaseReferencePeriod(
			release("la", "2023-05-uk-bgc", "LAD, May 2023 (UK)"),
		),
	).toEqual({ year: 2023, month: 5 });
	expect(releaseReferencePeriod(release("z", "2021-ni"))).toEqual({
		year: 2021,
		month: null,
	});
	expect(() =>
		releaseReferencePeriod(
			release("la", "2023-05-uk-bgc", "LAD, June 2023"),
		),
	).toThrow(/title says June 2023/);
	expect(() => releaseReferencePeriod(release("la", "2023-13-uk"))).toThrow(
		/not 01-12/,
	);
	expect(() => releaseReferencePeriod(release("la", "latest"))).toThrow(
		/start with a year/,
	);
});
