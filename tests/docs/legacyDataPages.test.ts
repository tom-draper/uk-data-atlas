import { describe, expect, it } from "vitest";
import { DATASET_THEMES } from "@uk-data-atlas/datasets";
import { LEGACY_DATA_PAGES } from "@/lib/docs/legacyDataPages";
import { readingOrder } from "@/lib/docs/navigation";
import { loadApiContract } from "@/lib/docs/openapi";

const pages = new Set(readingOrder(loadApiContract()).map((link) => link.href));

describe("legacy data page redirects", () => {
	it("lead to pages that exist", () => {
		const missing = Object.entries(LEGACY_DATA_PAGES)
			.filter(([, destination]) => !pages.has(destination))
			.map(([slug]) => slug);
		expect(missing).toEqual([]);
	});

	it("only redirect an old dataset address that no theme now uses", () => {
		// The population page became the population theme, at the same address.
		const themes = new Set<string>(DATASET_THEMES.map(({ id }) => id));
		expect(
			Object.keys(LEGACY_DATA_PAGES).filter((slug) => themes.has(slug)),
		).toEqual(["population"]);
	});
});
