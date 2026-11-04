import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterAll, expect, test, vi } from "vitest";
import { PLACE_LOOKUPS } from "@uk-data-atlas/datasets/data/gazetteer/places";

const fixture = await vi.hoisted(async () => {
	const { mkdtempSync } = await import("node:fs");
	const { tmpdir } = await import("node:os");
	const { join } = await import("node:path");
	const root = mkdtempSync(join(tmpdir(), "atlas-assets-lookup-"));
	return {
		root,
		boundary: join(root, "data/build/website-boundaries"),
		source: join(root, "data/source"),
		output: join(root, "public/data/datasets"),
	};
});

vi.mock("../src/precompile/paths.mts", () => ({
	ROOT: fixture.root,
	BOUNDARY_DATA: fixture.boundary,
	SOURCE_DATA: fixture.source,
}));
vi.mock("@uk-data-atlas/geography", async (importOriginal) => ({
	...(await importOriginal<typeof import("@uk-data-atlas/geography")>()),
	parseBoundaryWardToLad: () => ({}),
	parseParishLadMappings: () => ({}),
}));
vi.mock("@uk-data-atlas/datasets/data/gazetteer/loader", () => ({
	loadGazetteerCore: vi.fn(async () => ({ places: [] })),
}));
vi.mock("../../lib/data/gazetteer/matchIndex", () => ({
	loadMatchIndex: async () => ({}),
}));
vi.mock("../../scripts/atlas-lookups", () => ({ readAtlasLookup: () => "{}" }));
vi.mock("../src/precompile/websiteOutput.mts", async () => {
	const { mkdirSync, writeFileSync } = await import("node:fs");
	const { join } = await import("node:path");
	return {
		OUT_DIR: fixture.output,
		outputMatches: async () => true,
		out: async (name: string, data: unknown) => {
			mkdirSync(fixture.output, { recursive: true });
			const json = JSON.stringify(data);
			writeFileSync(join(fixture.output, `${name}.json`), json);
			return { bytes: json.length, sha256: "output" };
		},
	};
});

import { loadGazetteerCore } from "@uk-data-atlas/datasets/data/gazetteer/loader";
import { compileAtlasAssets } from "../src/precompile/atlasAssets.mts";

afterAll(() => rmSync(fixture.root, { recursive: true, force: true }));

test("gazetteer cache rebuilds when a lookup changes", async () => {
	mkdirSync(join(fixture.boundary, "boundaries"), { recursive: true });
	for (const { lookup, file } of PLACE_LOOKUPS) {
		const path = join(fixture.source, "lookups", lookup, file);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, "initial");
	}
	const context = {
		canReuse: false,
		existingManifest: {},
		datasetFingerprints: {},
		existingDatasets: new Map(),
		sourceRelease: undefined,
	};
	const first = await compileAtlasAssets(context);
	const gazetteer = await first.gazetteerCore;
	const matchIndex = await first.matchIndex;
	const existingManifest = {
		artifacts: {
			atlasAssets: {
				inputs: first.recordedBoundaryInputs,
				lookupInputs: first.recordedLookupInputs,
				outputs: { gazetteerCore: gazetteer.compiled, matchIndex },
			},
		},
	};
	await (
		await compileAtlasAssets({
			...context,
			canReuse: true,
			existingManifest,
		})
	).gazetteerCore;
	expect(loadGazetteerCore).toHaveBeenCalledTimes(1);
	const lookup = PLACE_LOOKUPS[0]!;
	writeFileSync(
		join(fixture.source, "lookups", lookup.lookup, lookup.file),
		"changed lookup",
	);
	await (
		await compileAtlasAssets({
			...context,
			canReuse: true,
			existingManifest,
		})
	).gazetteerCore;
	expect(loadGazetteerCore).toHaveBeenCalledTimes(2);
});
