import assert from "node:assert/strict";
import { test } from "vitest";
import { stageScope } from "@/pipeline/build-data-cache.mjs";
import { buildDataStages } from "@/pipeline/build-data-graph.mjs";

type Stage = {
	name: string;
	writes?: string[];
	cacheable?: boolean;
	exclusive?: boolean;
	requiredOutputs?: string[];
};

const stages = buildDataStages as Stage[];
const overlaps = (a: string, b: string) =>
	a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);

test("only the stages that rewrite sources or checked-in code run alone", () => {
	assert.deepEqual(
		stages
			.filter((stage) => !stageScope(stage) || stage.exclusive)
			.map(({ name }) => name),
		["sources", "catalogue-registry", "website-registry"],
	);
});

test("the catalogue registry tracks the checked-in files it generates", () => {
	const registry = stages.find(
		(stage) => stage.name === "catalogue-registry",
	);
	assert.ok(registry);
	assert.equal(registry.cacheable, true);
	assert.deepEqual(registry.requiredOutputs, [
		"packages/datasets/src/data/catalog/definitions/index.ts",
		"packages/datasets/src/data/catalog/registry.ts",
		"packages/datasets/src/data/catalog/generated.ts",
	]);
});

test("the website registry tracks the checked-in files it generates", () => {
	const registry = stages.find((stage) => stage.name === "website-registry");
	assert.ok(registry);
	assert.equal(registry.cacheable, true);
	assert.deepEqual(registry.requiredOutputs, [
		"lib/datasets/generated.ts",
		"lib/datasets/generatedCharts.tsx",
	]);
});

test("every declared path is under the build outputs", () => {
	for (const stage of stages.filter((stage) => !stage.exclusive))
		for (const path of stageScope(stage) ?? [])
			assert.match(path, /^(data\/build|public\/data)\//, stage.name);
});

test("the shared databases name every stage that writes them", () => {
	const writers = (path: string) =>
		stages
			.filter((stage) =>
				(stageScope(stage) ?? []).some((own) => overlaps(own, path)),
			)
			.map(({ name }) => name);
	assert.deepEqual(writers("data/build/atlas.sqlite"), ["assemble-atlas"]);
	assert.deepEqual(writers("data/build/atlas-cache.sqlite"), [
		"atlas-sqlite",
		"place-index",
		"area-search-index",
		"postcode-counts",
		"atlas-cache-stamp",
	]);
	assert.deepEqual(writers("data/build/atlas-base.sqlite"), ["atlas-sqlite"]);
});

test("the only stages that share a path are the cache writers and the two release builds", () => {
	const shared = new Set<string>();
	for (const [index, first] of stages.entries())
		for (const second of stages.slice(index + 1))
			if (
				(stageScope(first) ?? []).some((a) =>
					(stageScope(second) ?? []).some((b) => overlaps(a, b)),
				)
			) {
				shared.add(first.name);
				shared.add(second.name);
			}
	assert.deepEqual(
		[...shared].sort(),
		[
			"area-search-index",
			"atlas-cache-stamp",
			"atlas-release",
			"atlas-release-initial",
			"atlas-sqlite",
			"place-index",
			"postcode-counts",
		].sort(),
	);
});
