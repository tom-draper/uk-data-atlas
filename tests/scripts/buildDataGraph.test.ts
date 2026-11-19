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
	shared?: string[];
	scratch?: string[];
	finishedBy?: string;
	dependencies: string[];
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
		"packages/datasets/src/data/declarations.ts",
		"packages/datasets/src/declaration/declaredGuides.ts",
		"packages/datasets/src/declaration/declaredSources.ts",
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
	assert.deepEqual(writers("data/build/atlas-build.sqlite"), [
		"assemble-atlas",
	]);
	assert.deepEqual(writers("data/build/atlas-cache.sqlite"), [
		"assemble-cache",
	]);
	assert.deepEqual(
		writers("data/build/atlas-cache-parts/postcode-counts.sqlite"),
		["postcode-counts"],
	);
	assert.deepEqual(writers("data/build/atlas-base.sqlite"), ["atlas-sqlite"]);
	assert.deepEqual(writers("data/build/atlas-base-build.sqlite"), [
		"atlas-sqlite",
	]);
	assert.deepEqual(writers("data/build/website-assets.sqlite"), [
		"website-lookups",
	]);
});

test("each stage that builds a cache component writes a part of its own, which assemble-cache copies into the cache", () => {
	const find = (name: string) => {
		const found = stages.find((stage) => stage.name === name);
		assert.ok(found, name);
		return found;
	};
	const parts = {
		"place-index": "place-index",
		"area-search-index": "area-search",
		"postcode-counts": "postcode-counts",
	};
	for (const [name, component] of Object.entries(parts)) {
		const part = `data/build/atlas-cache-parts/${component}.sqlite`;
		assert.deepEqual(find(name).writes, [part], name);
		assert.deepEqual(find(name).requiredOutputs, [part], name);
		assert.equal(find(name).cacheable, true, name);
		assert.ok(
			find("assemble-cache").dependencies.includes(name),
			`${name} is assembled`,
		);
	}
	assert.ok(
		find("assemble-cache").requiredOutputs?.includes(
			"data/build/atlas-cache.sqlite",
		),
	);
	assert.deepEqual(find("assemble-cache").writes, [
		"data/build/atlas-cache.sqlite",
	]);
	// Nothing reads the assembled cache before it is published.
	assert.ok(find("documents").dependencies.includes("assemble-cache"));
	// The base build leaves its two components in parts of its own, and the
	// cache is not among the files it writes.
	const base = find("atlas-sqlite");
	assert.deepEqual(base.writes, [
		"data/build/atlas-base.sqlite",
		"data/build/atlas-base-build.sqlite",
		"data/build/atlas-cache-parts/projections.sqlite",
		"data/build/atlas-cache-parts/datasets.sqlite",
	]);
	assert.ok(find("assemble-cache").dependencies.includes("atlas-sqlite"));
});

test("no stage is left uncacheable except the sources download", () => {
	assert.deepEqual(
		stages
			.filter((stage) => stage.cacheable === false)
			.map(({ name }) => name),
		["sources"],
	);
});

test("crosswalk weights are built before the atlas is assembled, from the counts they share", () => {
	const weights = stages.find((stage) => stage.name === "crosswalk-weights");
	assert.ok(weights);
	assert.deepEqual(weights.requiredOutputs, [
		"data/build/crosswalk-weights/crosswalk-weights.sqlite",
	]);
	assert.ok(weights.dependencies.includes("atlas-sqlite"));
	assert.ok(weights.dependencies.includes("geometry-store"));
	assert.ok(
		stages
			.find((stage) => stage.name === "assemble-atlas")
			?.dependencies.includes("crosswalk-weights"),
	);
	const inputs = (
		buildDataStages as Array<{ name: string; rawInputs?: unknown }>
	).find((stage) => stage.name === "crosswalk-weights")?.rawInputs;
	assert.equal(typeof inputs, "function");
});

test("converted series are built from the backtest, before the atlas is assembled", () => {
	const converted = stages.find((stage) => stage.name === "converted-series");
	assert.ok(converted);
	assert.deepEqual(converted.requiredOutputs, [
		"data/build/converted-series/converted-series.sqlite",
		"data/build/converted-series/converted-series.md",
	]);
	for (const dependency of [
		"atlas-sqlite",
		"crosswalk-weights",
		"conversion-backtest",
	])
		assert.ok(converted.dependencies.includes(dependency));
	assert.ok(
		stages
			.find((stage) => stage.name === "assemble-atlas")
			?.dependencies.includes("converted-series"),
	);
});
