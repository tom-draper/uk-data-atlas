import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { format, resolveConfig } from "prettier";
import {
	readDatasetDeclarations,
	renderDeclaredGuides,
} from "../../src/catalog/buildCatalogueRegistry.ts";

/**
 * The guides module is generated from the declarations and checked in, so the
 * registry can list datasets without loading their readers. A declaration
 * whose guide changed without `pnpm data:build --only catalogue-registry`
 * fails here.
 */
test("the checked-in guides are the ones the declarations write", async () => {
	const path = new URL(
		"../../../packages/datasets/src/declaration/declaredGuides.ts",
		import.meta.url,
	);
	const filepath = path.pathname;
	const expected = await format(
		renderDeclaredGuides(await readDatasetDeclarations()),
		{ ...(await resolveConfig(filepath)), filepath },
	);
	expect(readFileSync(path, "utf8")).toBe(expected);
});
