import { readFileSync } from "node:fs";
import { join } from "node:path";
import { format, resolveConfig } from "prettier";
import { describe, expect, it } from "vitest";
import {
	boundaryCoverageMarkdown,
	DATASET_SOURCES,
	datasetSourcesMarkdown,
} from "@/lib/data/catalog";

const readme = readFileSync(join(process.cwd(), "README.md"), "utf8");
const start = "<!-- sources:start -->";
const end = "<!-- sources:end -->";
const boundariesStart = "<!-- boundaries:start -->";
const boundariesEnd = "<!-- boundaries:end -->";

/** The generator formats its tables with Prettier before writing the README. */
const formatted = async (markdown: string) => {
	const path = join(process.cwd(), "README.md");
	const config = await resolveConfig(path);
	return (await format(markdown, { ...config, filepath: path })).trim();
};

describe("dataset sources", () => {
	it("uses unique source names", () => {
		const names = DATASET_SOURCES.map((source) => source.name);
		expect(new Set(names).size).toBe(names.length);
	});

	it("keeps the README table generated from the shared source list", async () => {
		const startIndex = readme.indexOf(start);
		const endIndex = readme.indexOf(end);
		expect(startIndex).toBeGreaterThanOrEqual(0);
		expect(endIndex).toBeGreaterThan(startIndex);
		expect(readme.slice(startIndex + start.length, endIndex).trim()).toBe(
			await formatted(datasetSourcesMarkdown()),
		);
	});

	it("keeps the README boundary inventory generated from the boundary catalogue", async () => {
		const startIndex = readme.indexOf(boundariesStart);
		const endIndex = readme.indexOf(boundariesEnd);
		expect(startIndex).toBeGreaterThanOrEqual(0);
		expect(endIndex).toBeGreaterThan(startIndex);
		expect(
			readme.slice(startIndex + boundariesStart.length, endIndex).trim(),
		).toBe(await formatted(boundaryCoverageMarkdown()));
	});
});
