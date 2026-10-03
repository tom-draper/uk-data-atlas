import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
	MAP_FIGURES_PATH,
	readFigureInputs,
	serialiseMapFigures,
} from "../../scripts/map-figures";

describe("map figures", () => {
	it("match the committed datasets; run pnpm figures:build if not", async () => {
		const committed = await readFile(MAP_FIGURES_PATH, "utf8");
		expect(serialiseMapFigures(await readFigureInputs())).toBe(committed);
	}, 60_000);
});
