import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStageCache } from "../../pipeline/build-data-cache.mjs";
import { sourceMetadataInputs } from "../../pipeline/build-data-inputs.mjs";
import { discoverDatasets } from "../../pipeline/src/precompile/datasetDiscovery";
import { createSourceInventory } from "../../pipeline/src/geographies/sourceInventory";
import { readDistFacts } from "../../scripts/build-dist.mts";

/**
 * Sources in `data/source/_staging/` are downloaded but not built
 * (docs/data-organisation.md, "Staged sources"). Every walk of `data/source`
 * that feeds a build, the website, the API or the dist tree must skip them.
 * Each test puts one built source and one staged source in a temporary tree
 * and checks that only the built one is seen.
 */

const meta = (id: string, extra: Record<string, unknown> = {}) =>
	JSON.stringify({
		id,
		title: id,
		publisher: "Test publisher",
		sourceUrl: "https://example.org/",
		licence: { name: "Open Government Licence v3.0" },
		files: [{ path: "data.csv", role: "source" }],
		...extra,
	});

const BUILT = "society/crime-and-justice/crime";
const STAGED = "_staging/gp-appointments";

let root: string;
const write = (path: string, text: string) => {
	mkdirSync(dirname(join(root, path)), { recursive: true });
	writeFileSync(join(root, path), text);
};

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "atlas-staged-sources-"));
	write("data/source/code.txt", "code");
	write(
		`data/source/${BUILT}/meta.json`,
		meta("crime", { dataset: "crime" }),
	);
	write(
		`data/source/${STAGED}/meta.json`,
		meta("gp-appointments", { kind: "staged" }),
	);
	write(`data/source/${STAGED}/data.csv`, "a,b\n");
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("staged sources", () => {
	it("are not discovered as datasets", async () => {
		const found = await discoverDatasets(join(root, "data/source"));
		expect(found.map(({ id }) => id)).toEqual([BUILT]);
	});

	it("are not in the source inventory", () => {
		const keys = createSourceInventory(root).sources.map(({ key }) => key);
		expect(keys).toEqual([BUILT]);
	});

	it("are not a raw input of a stage", () => {
		expect(sourceMetadataInputs(root)).toEqual([`${BUILT}/meta.json`]);
	});

	it("do not change what a stage reads", () => {
		const stage = { name: "stage", dependencies: [], args: ["stage"] };
		const cache = () =>
			createStageCache({
				root,
				codeFiles: () => [],
				environment: {},
			});
		let current = cache();
		current.begin(stage.name);
		current.record(stage, []);
		write(`data/source/${STAGED}/data.csv`, "a,b\nchanged\n");
		write("data/source/_staging/new-source/meta.json", "new");
		current = cache();
		expect(current.lookup(stage, [])).not.toBeNull();
		write(`data/source/${BUILT}/data.csv`, "changed");
		current = cache();
		expect(current.lookup(stage, [])).toBeNull();
	});

	it("are not described in the dist tree, even with a meta.json that does not parse", () => {
		write("data/source/_staging/half-edited/meta.json", "{");
		const facts = readDistFacts(join(root, "data/source"));
		expect(Object.keys(facts.datasets)).toEqual(["crime"]);
		expect(facts.foundation).toEqual({
			core: [],
			boundaries: [],
			postcodes: [],
		});
	});
});
