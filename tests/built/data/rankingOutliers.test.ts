import { readAtlasPayload } from "@uk-data-atlas/atlas-runtime/storage";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { MapRanking } from "@/lib/atlas/rankings";
import { decodeCompactPayload } from "@/lib/data/compactPayload";

/**
 * A sanity check on the published figures. A council's count, per resident,
 * should be within a factor of 20 of the typical council's: one far outside
 * that is more often a publisher's gap than a real place. Kent's crime counts,
 * which the police filed under "Unassigned" for five areas, were around 500
 * times too small. A council that really is that far out is listed below with
 * the reason, once someone has checked it.
 */

const DATASETS = join(process.cwd(), "public", "data", "datasets");

/** Maps ranked by a count of things in a council, which grows with its size. */
const COUNT_MAPS = [
	"adult-social-care-activity",
	"business-activity",
	"crime",
	"electric-vehicle-chargers",
	"electricity-consumption",
	"gas-consumption",
	"jobs",
	"net-additional-dwellings",
	"planning-applications",
	"waste",
];

const FACTOR = 20;

const CITY_OF_LONDON =
	"The City of London has about 10,000 residents and a working population many times that.";
const NO_GAS_GRID = "The islands have no mains gas network.";

/** Reviewed outliers, by map and council code. */
const REVIEWED: Readonly<Record<string, string>> = {
	"business-activity/E09000001": CITY_OF_LONDON,
	"electricity-consumption/E09000001": CITY_OF_LONDON,
	"jobs/E09000001": CITY_OF_LONDON,
	"gas-consumption/E06000053": NO_GAS_GRID,
	"gas-consumption/S12000023": NO_GAS_GRID,
	"gas-consumption/S12000027": NO_GAS_GRID,
};

async function residents(): Promise<Map<string, number>> {
	const editions = decodeCompactPayload(
		JSON.parse(readAtlasPayload(process.cwd(), "dataset:population-uk")),
	) as Record<string, { data: Record<string, { total?: unknown }> }>;
	const latest = editions[Object.keys(editions).sort().at(-1)!]!;
	const counts = new Map<string, number>();
	for (const [code, record] of Object.entries(latest.data)) {
		const total = Object.values(
			(record.total ?? {}) as Record<string, number>,
		).reduce((sum, count) => sum + count, 0);
		if (total > 0) counts.set(code, total);
	}
	return counts;
}

/** The councils whose count per resident is a factor or more from the median. */
function outliers(
	ranking: MapRanking,
	people: ReadonlyMap<string, number>,
	factor = FACTOR,
): { code: string; name: string; ratio: number }[] {
	const rates = ranking.areas.flatMap((area) => {
		const residents = people.get(area.code);
		return residents ? [{ area, rate: area.value / residents }] : [];
	});
	const sorted = rates.map(({ rate }) => rate).sort((a, b) => a - b);
	const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
	if (median <= 0) return [];
	return rates
		.filter(({ rate }) => rate > median * factor || rate < median / factor)
		.map(({ area, rate }) => ({
			code: area.code,
			name: area.name,
			ratio: rate / median,
		}));
}

describe("ranked counts are in line with population", () => {
	it.each(COUNT_MAPS)("%s", async (map) => {
		const ranking = JSON.parse(
			await readFile(join(DATASETS, "rankings", `${map}.json`), "utf8"),
		) as MapRanking;
		const unexplained = outliers(ranking, await residents())
			.filter(({ code }) => !REVIEWED[`${map}/${code}`])
			.map(
				({ name, code, ratio }) =>
					`${name} (${code}): ${ratio < 1 ? `${(1 / ratio).toFixed(0)} times below` : `${ratio.toFixed(0)} times above`} the median per resident`,
			);
		expect(unexplained).toEqual([]);
	});

	it("lists only exceptions that are still outliers", async () => {
		const people = await residents();
		const stale: string[] = [];
		for (const key of Object.keys(REVIEWED)) {
			const [map, code] = key.split("/") as [string, string];
			const ranking = JSON.parse(
				await readFile(
					join(DATASETS, "rankings", `${map}.json`),
					"utf8",
				),
			) as MapRanking;
			if (!outliers(ranking, people).some((area) => area.code === code))
				stale.push(key);
		}
		expect(stale).toEqual([]);
	});

	it("would have caught Kent's missing crime", () => {
		const ranking: MapRanking = {
			map: "crime",
			level: "localAuthority",
			areas: [
				{ code: "A", name: "A", district: "A", value: 7_000 },
				{ code: "B", name: "B", district: "B", value: 9_000 },
				{ code: "C", name: "C", district: "C", value: 8_000 },
				{
					code: "Maidstone",
					name: "Maidstone",
					district: "M",
					value: 33,
				},
			],
		};
		const people = new Map([
			["A", 100_000],
			["B", 120_000],
			["C", 110_000],
			["Maidstone", 187_767],
		]);
		expect(outliers(ranking, people).map((area) => area.name)).toEqual([
			"Maidstone",
		]);
	});
});
