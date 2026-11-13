import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { checkDistFacts, readDistFacts } from "../../../scripts/build-dist.mjs";

/**
 * Every dataset must have a recorded, known licence in `data/source`
 * (docs/data-organisation.md, task 12). Needs the raw sources, which are not in
 * git, so it skips when they are absent.
 */
const source = join(process.cwd(), "data/source");

it.skipIf(!existsSync(source))(
	"describes every module with licences that resolve",
	() => {
		expect(checkDistFacts(readDistFacts(source))).toEqual([]);
	},
);
