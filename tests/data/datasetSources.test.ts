import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DATASET_SOURCES, datasetSourcesMarkdown } from "@/lib/data/catalog";

const readme = readFileSync(join(process.cwd(), "README.md"), "utf8");
const start = "<!-- sources:start -->";
const end = "<!-- sources:end -->";

describe("dataset sources", () => {
	it("uses unique source names", () => {
		const names = DATASET_SOURCES.map((source) => source.name);
		expect(new Set(names).size).toBe(names.length);
	});

	it("keeps the README table generated from the shared source list", () => {
		const startIndex = readme.indexOf(start);
		const endIndex = readme.indexOf(end);
		expect(startIndex).toBeGreaterThanOrEqual(0);
		expect(endIndex).toBeGreaterThan(startIndex);
		expect(readme.slice(startIndex + start.length, endIndex).trim()).toBe(
			datasetSourcesMarkdown(),
		);
	});
});
