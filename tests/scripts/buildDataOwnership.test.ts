import assert from "node:assert/strict";
import { test } from "vitest";
import {
	assertStageOwnership,
	ownershipProblems,
} from "@/pipeline/build-data-ownership.mjs";
import { buildDataStages } from "@/pipeline/build-data-graph.mjs";

type Stage = {
	name: string;
	writes?: string[];
	outputs?: string[];
	requiredOutputs?: string[];
	cacheable?: boolean;
};

test("stages with separate paths own them", () => {
	const stages: Stage[] = [
		{ name: "a", writes: ["data/build/a.json"] },
		{ name: "b", writes: ["data/build/b"], outputs: ["data/build/b"] },
		{ name: "c", requiredOutputs: ["data/build/c.sqlite"] },
		{ name: "download", cacheable: false },
	];
	assert.deepEqual(ownershipProblems(stages), []);
	assert.equal(assertStageOwnership(stages), stages);
});

test("two stages may not declare the same path, or one inside the other", () => {
	const problems = ownershipProblems([
		{ name: "first", writes: ["data/build/shared.sqlite", "data/build/x"] },
		{ name: "second", writes: ["data/build/shared.sqlite"] },
		{ name: "third", outputs: ["data/build/x/part.json"] },
	]);
	assert.deepEqual(problems, [
		"first and second both write data/build/shared.sqlite. A path has one owning stage.",
		"first and third both write data/build/x and data/build/x/part.json. A path has one owning stage.",
	]);
	assert.throws(
		() =>
			assertStageOwnership([
				{ name: "first", writes: ["data/build/a"] },
				{ name: "second", writes: ["data/build/a"] },
			]),
		/breaks stage ownership[\s\S]*first and second both write data\/build\/a/,
	);
});

test("a stage that declares nothing is refused unless it is the uncached download", () => {
	assert.deepEqual(ownershipProblems([{ name: "quiet" }]), [
		"quiet declares no paths. Every stage must declare the files and folders it writes.",
	]);
	assert.deepEqual(
		ownershipProblems([{ name: "sources", cacheable: false }]),
		[],
	);
});

test("no two stages in the build graph declare the same path", () => {
	assert.deepEqual(ownershipProblems(buildDataStages as Stage[]), []);
	// A stage that is added without its paths, or with another's, is refused
	// as the graph loads.
	assert.throws(
		() =>
			assertStageOwnership([
				...(buildDataStages as Stage[]),
				{ name: "new-stage", writes: ["data/build/atlas.sqlite"] },
			]),
		/new-stage and assemble-atlas|assemble-atlas and new-stage/,
	);
});

test("scoped outputs must belong to a direct cacheable dependency", () => {
	const producer = { name: "producer", writes: ["data/build/parts"] };
	const consumer = { name: "consumer", writes: ["data/build/summary.json"] };
	assert.deepEqual(
		ownershipProblems([
			producer,
			{
				...consumer,
				dependencies: ["producer"],
				dependencyOutputs: {
					producer: ["data/build/parts/main.sqlite"],
				},
			},
		]),
		[],
	);
	assert.deepEqual(
		ownershipProblems([
			producer,
			{ name: "sources", cacheable: false },
			{
				...consumer,
				dependencies: ["producer", "sources"],
				dependencyOutputs: {
					producer: ["data/build/parts-other/main.sqlite"],
					sources: ["data/build/parts/main.sqlite"],
					missing: ["whatever"],
				},
			},
		]),
		[
			"consumer scopes producer to data/build/parts-other/main.sqlite, which producer does not own.",
			"consumer scopes sources, which must be a direct, cacheable dependency.",
			"consumer scopes missing, which must be a direct, cacheable dependency.",
		],
	);
});
