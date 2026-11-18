import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { format, resolveConfig } from "prettier";
import {
	readDatasetDeclarations,
	renderDeclaredGuides,
	renderDeclaredSources,
} from "../../src/catalog/buildCatalogueRegistry.ts";

/**
 * Two modules the registry entry point reads are generated from the
 * declarations and checked in, so it can list datasets and source folders
 * without loading their readers. A declaration changed without
 * `pnpm data:build --only catalogue-registry` fails here.
 */
test.each([
	["guides", "declaredGuides.ts", renderDeclaredGuides],
	["source folders", "declaredSources.ts", renderDeclaredSources],
] as const)(
	"the checked-in %s are the ones the declarations write",
	async (_name, file, render) => {
		const path = new URL(
			`../../../packages/datasets/src/declaration/${file}`,
			import.meta.url,
		);
		const filepath = path.pathname;
		const expected = await format(render(await readDatasetDeclarations()), {
			...(await resolveConfig(filepath)),
			filepath,
		});
		expect(readFileSync(path, "utf8")).toBe(expected);
	},
);
