import assert from "node:assert/strict";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "vitest";
import { BOUNDARY_CATALOG, propertiesAsset } from "@uk-data-atlas/datasets";
import { codeListId, readMapValues } from "@uk-data-atlas/map-tiles/mapValues";
import { featureIds } from "@uk-data-atlas/map-tiles/featureIds";
import { buildMapValues } from "../../src/maps/buildMapValues.ts";

const boundaryYear = 2025;
const asset = BOUNDARY_CATALOG.localAuthority.vintages[boundaryYear]!;
const release = BOUNDARY_CATALOG.localAuthority.releases.find(
	(candidate) => candidate.asset === asset,
)!;

function fixture(context: { onTestFinished: (run: () => void) => void }) {
	const root = mkdtempSync(join(tmpdir(), "map-values-"));
	context.onTestFinished(() =>
		rmSync(root, { recursive: true, force: true }),
	);
	const datasetsDir = join(root, "datasets");
	const paths = {
		readDataset: async (output: string) =>
			JSON.parse(
				readFileSync(join(datasetsDir, `${output}.json`), "utf8"),
			),
		boundariesDir: join(root, "boundaries"),
		outDir: join(root, "out"),
	};
	mkdirSync(datasetsDir, { recursive: true });
	const sidecar = join(
		paths.boundariesDir,
		propertiesAsset(asset).replace(/^\/?data\/boundaries\//, ""),
	);
	mkdirSync(dirname(sidecar), { recursive: true });
	// Listed out of order: the array follows the sorted code list, not the sidecar.
	const codes = ["E06000003", "E06000001", "E06000002", "E06000004"];
	writeFileSync(
		sidecar,
		JSON.stringify({
			release: `localAuthority/${release.id}`,
			features: codes.map((code) => ({ [release.codeKey]: code })),
		}),
	);
	writeFileSync(
		join(datasetsDir, "council-tax.json"),
		JSON.stringify({
			"2025": {
				type: "councilTax",
				year: 2025,
				boundaryType: "localAuthority",
				boundaryYear,
				data: {
					E06000001: { code: "E06000001", value: 10 },
					E06000002: { code: "E06000002", value: null },
					E06000003: { code: "E06000003", value: 0 },
					// Not in the release, so it has no place in the array.
					W06000099: { code: "W06000099", value: 99 },
				},
			},
		}),
	);
	return { paths, codes };
}

const definition = [
	{
		type: "councilTax",
		precompiledFile: "council-tax",
		boundaryType: "localAuthority",
		mapValueField: "value",
	},
] as const;

test("writes one array per dataset in code-list order with nulls", async (context) => {
	const { paths, codes } = fixture(context);
	const manifest = await buildMapValues(paths, definition);
	const entries = Object.entries(manifest.entries);
	assert.equal(entries.length, 1);
	const [key, entry] = entries[0]!;
	assert.equal(key, `councilTax/localAuthority/${release.id}/2025`);
	const sorted = [...codes].sort();
	const codeList = codeListId(sorted);
	assert.deepEqual(entry.codeList, codeList);
	const values = readMapValues(
		readFileSync(join(paths.outDir, entry.file), "utf8"),
		entry,
		codeList,
	);
	assert.deepEqual(values, [10, null, 0, null]);
	assert.equal(entry.valueCount, 2);
	// The value at index i is for the tile feature id i + 1.
	const ids = featureIds(codes);
	assert.equal(values[(ids.get("E06000001") ?? 0) - 1], 10);
	assert.equal(values[(ids.get("E06000003") ?? 0) - 1], 0);
});

test("skips a dataset that declares no map value field", async (context) => {
	const { paths } = fixture(context);
	const manifest = await buildMapValues(paths, [
		{ ...definition[0], mapValueField: undefined },
	]);
	assert.deepEqual(manifest.entries, {});
});

test("rejects a dataset on another geography than its definition", async (context) => {
	const { paths } = fixture(context);
	await assert.rejects(
		buildMapValues(paths, [{ ...definition[0], boundaryType: "ward" }]),
		/not ward/,
	);
});
