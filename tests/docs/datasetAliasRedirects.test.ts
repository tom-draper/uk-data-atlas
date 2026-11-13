import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";
import {
	DATASET_ALIASES,
	REGISTERED_DATASETS,
} from "@uk-data-atlas/datasets/registry";
import { readingOrder } from "@/lib/docs/navigation";
import { loadApiContract } from "@/lib/docs/openapi";

const pages = new Set(readingOrder(loadApiContract()).map((link) => link.href));

describe("merged dataset redirects", () => {
	it("send each retired docs and atlas address to the merged dataset", async () => {
		const redirects = (await nextConfig.redirects?.()) ?? [];
		for (const [old, alias] of Object.entries(DATASET_ALIASES)) {
			expect(redirects).toContainEqual({
				source: `/docs/v1/datasets/:theme/:topic/${old}`,
				destination: `/docs/v1/datasets/:theme/:topic/${alias.dataset}`,
				permanent: true,
			});
			expect(redirects).toContainEqual({
				source: `/atlas/:location/${old}`,
				destination: `/atlas/:location/${alias.dataset}`,
				permanent: true,
			});
		}
	});

	it("land on a documented dataset page", () => {
		for (const alias of Object.values(DATASET_ALIASES)) {
			const dataset = REGISTERED_DATASETS.find(
				({ id }) => id === alias.dataset,
			);
			expect(dataset, alias.dataset).toBeDefined();
			expect(
				pages.has(
					`/docs/v1/datasets/${dataset!.theme}/${dataset!.topic}/${dataset!.id}`,
				),
				alias.dataset,
			).toBe(true);
		}
	});
});
