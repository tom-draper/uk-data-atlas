import { expect, test } from "vitest";
import { isFastifyDetailPath } from "../src/fastifyDetailPaths";

test("detail paths Fastify can route are recognised", () => {
	for (const path of [
		"/v1/datasets/population",
		"/v1/measures/%70opulation",
		"/v1/boundary-releases/ward/2024",
		"/v1/data/population/export",
		"/v1/documents/geography-inventory.json",
		"/v1/atlas-lookups/area-lineage.json",
		"/v1/atlas-pages/places-index.json",
		"/v1/documents/a%2Fb.json",
		"/v1/exports/total-jobs-observations",
		"/v1/lookups/areas-ward-2025-05",
	])
		expect(isFastifyDetailPath(path), path).toBe(true);
});

test("detail paths the dispatcher must keep are not recognised", () => {
	for (const path of [
		// Not a detail shape.
		"/v1/documents",
		"/v1/atlas-lookups",
		"/v1/atlas-lookups/area-lineage",
		"/v1/atlas-pages/places-index.json/",
		"/v1/documents/geography-inventory",
		"/v1/documents/geography-inventory.json/",
		"/v1/documents/a/b.json",
		"/v1/exports",
		"/v1/lookups/areas-ward-2025-05/",
		"/v1/exports/..",
		// A dot segment, a malformed escape or an id past Fastify's limit.
		"/v1/measures/..",
		"/v1/measures/%E0%A4%A",
		`/v1/measures/${"x".repeat(101)}`,
		`/v1/documents/${"x".repeat(96)}.json`,
		// The join operation is not a release.
		"/v1/boundary-releases/ward/2024:join",
	])
		expect(isFastifyDetailPath(path), path).toBe(false);
});
