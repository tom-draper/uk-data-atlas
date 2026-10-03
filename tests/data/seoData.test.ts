import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	MAP_FIGURES_PATH,
	readFigureInputs,
	serialiseMapFigures,
} from "../../scripts/map-figures";
import {
	RANKING_PAGES_PATH,
	RANKINGS_DIR,
	serialiseRankings,
} from "../../scripts/map-rankings";

describe("map page data; run pnpm seo:build if stale", () => {
	it("figures match the committed datasets", async () => {
		const committed = await readFile(MAP_FIGURES_PATH, "utf8");
		expect(serialiseMapFigures(await readFigureInputs())).toBe(committed);
	}, 60_000);

	it("rankings match the committed datasets", async () => {
		const { files: expected, pages } = await serialiseRankings();
		const files = (await readdir(RANKINGS_DIR)).sort();
		expect(files).toEqual(
			[...expected.keys()].map((slug) => `${slug}.json`).sort(),
		);
		for (const [slug, contents] of expected)
			expect(
				await readFile(join(RANKINGS_DIR, `${slug}.json`), "utf8"),
				slug,
			).toBe(contents);
		expect(await readFile(RANKING_PAGES_PATH, "utf8")).toBe(pages);
	}, 120_000);
});
