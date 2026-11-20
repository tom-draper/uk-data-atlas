import { expect, test } from "vitest";
import { measureSeriesKey } from "@uk-data-atlas/measures";
import { compileLifeExpectancy } from "../../src/catalog/lifeExpectancy.ts";
import { compileElections } from "../../src/catalog/elections.ts";
import type { CatalogManifest } from "../../src/catalog/manifest.ts";
import { sha256 } from "../../src/catalog/values.ts";
import { fixtureRows } from "./rowFixtures.ts";

test("life expectancy observations use canonical series keys and carry their intervals", () => {
	const rows = fixtureRows(
		(["male", "female"] as const).map((sex) => ({
			dataset: "life-expectancy-series",
			measure: "life-expectancy",
			geography: "localAuthority",
			release: "2025-uk-bgc",
			members: { sex },
			periods: {
				"2020-2022": {
					E06000001: { value: 80, lower: 79, upper: 81 },
				},
			},
		})),
	);
	const artifacts = [...compileLifeExpectancy(rows).artifacts];
	const expected = new Set(
		["male", "female"].map((sex) =>
			measureSeriesKey({
				measure: "life-expectancy",
				dimensions: { sex },
			}),
		),
	);
	for (const { contentHash, ...artifact } of artifacts) {
		expect(expected.delete(artifact.measureId)).toBe(true);
		expect(contentHash).toBe(sha256(JSON.stringify(artifact)));
		expect(artifact.periods[0]?.records[0]?.confidenceInterval).toEqual({
			lower: 79,
			upper: 81,
		});
	}
	expect(expected.size).toBe(0);
});

test("election observations preserve source partitions and canonical identities", () => {
	const polls = [
		["general-election", "constituency", "E14000001"],
		["local-election", "ward", "E05000001"],
	] as const;
	const day = (dataset: string, year: number) =>
		`${year}-${dataset === "general-election" ? "12" : "05"}-0${year === 2019 ? 2 : 4}`;
	const series = polls.flatMap(([dataset, geography, area]) =>
		[2019, 2024].flatMap((year) => {
			const base = {
				dataset,
				geography,
				release: `${year}-uk-bfc`,
			};
			const periods = (value: number) => ({
				[day(dataset, year)]: { [area]: value },
			});
			return [
				...(dataset === "general-election"
					? ["valid-votes", "electorate", "rejected-ballots"].map(
							(measure) => ({
								...base,
								measure,
								periods: periods(
									measure === "electorate" ? 150 : 100,
								),
							}),
						)
					: [{ ...base, measure: "turnout", periods: periods(70) }]),
				...[
					["con", 60],
					["lab", 40],
				].map(([party, votes]) => ({
					...base,
					measure: "party-votes",
					members: { party: party as string },
					periods: periods(votes as number),
				})),
			];
		}),
	);
	const rows = fixtureRows(
		series,
		[],
		polls.flatMap(([dataset, geography, area]) =>
			[2019, 2024].map((year) => ({
				dataset,
				geography,
				pollingDay: day(dataset, year),
				code: area,
				winner: "CON",
			})),
		),
	);
	try {
		const manifest = {
			manifestPath: "manifest",
			datasets: ["general-election", "local-election"].map((id) => ({
				id,
				summary: { datasetCount: 2, dataRecordCount: 2 },
			})),
		} as CatalogManifest;
		const result = compileElections(manifest, rows);
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
		rows.close();
	}
});
