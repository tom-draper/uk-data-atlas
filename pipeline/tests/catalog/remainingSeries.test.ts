import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { measureSeriesKey } from "@uk-data-atlas/measures";
import { compileLifeExpectancy } from "../../src/catalog/lifeExpectancy.ts";
import { compileElections } from "../../src/catalog/elections.ts";
import type { CatalogManifest } from "../../src/catalog/manifest.ts";
import { sha256 } from "../../src/catalog/values.ts";

test("life expectancy observations use canonical series keys", () => {
	const directory = mkdtempSync(join(tmpdir(), "remaining-series-"));
	try {
		const write = (name: string, data: unknown) => {
			const path = join(directory, `${name}.json`);
			writeFileSync(path, JSON.stringify(data));
			return path;
		};
		const estimate = { value: 80, lower: 79, upper: 81 };
		const life = write("life", {
			"2022": {
				period: "2020-2022",
				boundaryYear: 2025,
				boundaryType: "localAuthority",
				data: { E06000001: { male: estimate, female: estimate } },
			},
		});
		const artifacts = [...compileLifeExpectancy(life).artifacts];
		const expected = new Set([
			...["male", "female"].map((sex) =>
				measureSeriesKey({
					measure: "life-expectancy",
					dimensions: { sex },
				}),
			),
		]);
		for (const { contentHash, ...artifact } of artifacts) {
			expect(expected.delete(artifact.measureId)).toBe(true);
			expect(contentHash).toBe(sha256(JSON.stringify(artifact)));
		}
		expect(expected.size).toBe(0);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("election observations preserve source partitions and canonical identities", () => {
	const directory = mkdtempSync(join(tmpdir(), "election-series-"));
	try {
		const write = (name: string, geography: string, area: string) => {
			const path = join(directory, `${name}.json`);
			const data = Object.fromEntries(
				[2019, 2024].map((year) => [
					year,
					{
						year,
						boundaryYear: year,
						boundaryType: geography,
						data: {
							[area]: {
								validVotes: 100,
								totalVotes: 100,
								turnoutPercent: 70,
								partyVotes: { CON: 60, LAB: 40 },
							},
						},
						results: { [area]: "CON" },
					},
				]),
			);
			writeFileSync(path, JSON.stringify(data));
			return path;
		};
		const manifest = {
			manifestPath: directory,
			datasets: ["general-election", "local-election"].map((id) => ({
				id,
				summary: { datasetCount: 2, dataRecordCount: 2 },
			})),
		} as CatalogManifest;
		const result = compileElections(
			manifest,
			write("general", "constituency", "E14000001"),
			write("local", "ward", "E05000001"),
		);
		const expected = new Set([
			...(["general-election", "local-election"] as const).flatMap(
				(datasetId) => [
					measureSeriesKey({
						measure:
							datasetId === "general-election"
								? "valid-votes"
								: "effective-votes",
						datasetId,
					}),
					measureSeriesKey({ measure: "turnout", datasetId }),
					measureSeriesKey({ measure: "winning-party", datasetId }),
					...["con", "lab"].map((party) =>
						measureSeriesKey({
							measure: "party-votes",
							dimensions: { party },
							datasetId,
						}),
					),
				],
			),
			...["con", "lab"].map((party) =>
				measureSeriesKey({
					measure: "party-vote-share",
					dimensions: { party },
					datasetId: "general-election",
				}),
			),
		]);
		const partitions = new Map<string, number[]>();
		for (const artifact of result.artifacts)
			expect(result.observationDatasets.get(artifact)).toBe(
				artifact.sourceGeography.type === "ward"
					? "local-election"
					: "general-election",
			);
		for (const { contentHash, ...artifact } of result.artifacts) {
			expect(expected.has(artifact.measureId)).toBe(true);
			expect(contentHash).toBe(sha256(JSON.stringify(artifact)));
			partitions.set(artifact.measureId, [
				...(partitions.get(artifact.measureId) ?? []),
				artifact.sourceGeography.boundaryYear,
			]);
		}
		expect(new Set(partitions.keys())).toEqual(expected);
		for (const years of partitions.values())
			expect(years).toEqual([2019, 2024]);
		const winners = result.artifacts.find(
			(artifact) =>
				artifact.measureId ===
				measureSeriesKey({
					measure: "winning-party",
					datasetId: "general-election",
				}),
		);
		expect(winners?.periods[0]?.records[0]).toMatchObject({
			category: "CON",
		});
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
