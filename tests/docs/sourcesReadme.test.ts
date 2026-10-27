import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
	readmePath,
	renderSourcesReadme,
} from "../../scripts/generate-sources-readme.mjs";

it("lists the current dataset sources and boundary releases", async () => {
	const readme = readFileSync(readmePath, "utf8");
	// A stale README is fixed by running pnpm docs:sources.
	expect(await renderSourcesReadme(readme)).toBe(readme);
});
